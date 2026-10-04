import { AmbiguousSeasonError } from "../lib/errors";
import { canonicalSeasonKey, seasonYear } from "../lib/seasons";
import type { CompetitionSeason, SeasonSelector } from "../types";
/**
 * AFL API client with token authentication and typed fetch helpers.
 *
 * The client handles WMCTok token authentication, automatic 401 retry
 * with re-authentication, and Zod-validated JSON responses.
 *
 * Accepts an injectable `fetch` function for testability.
 */

import type { z } from "zod/v4";
import { batchedMap } from "../lib/concurrency";
import { AflApiError, ValidationError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { createSourceFetch, type SourceFetchOptions } from "../lib/source-fetch";
import {
  AflApiTokenSchema,
  type Compseason,
  CompseasonListSchema,
  type LadderResponse,
  LadderResponseSchema,
  type MatchItem,
  MatchItemListSchema,
  type MatchRoster,
  MatchRosterSchema,
  type PlayerStatsList,
  PlayerStatsListSchema,
  type Round,
  RoundListSchema,
  type SquadList,
  SquadListSchema,
  type TeamItem,
  TeamListSchema,
} from "../lib/validation";
import type { CompetitionCode } from "../types";

/** User-Agent sent with all AFL API requests. Required by the CFS endpoints. */
const USER_AGENT = "fitzroy/2 (https://github.com/jackemcpherson/fitzRoy-ts)";

/** WMCTok token endpoint used by the AFL website. */
const TOKEN_URL = "https://api.afl.com.au/cfs/afl/WMCTok";

/** Base URL for AFL API v2 data endpoints (no auth required). */
const API_BASE = "https://aflapi.afl.com.au/afl/v2";

/** Base URL for /cfs/ endpoints (requires WMCTok token). */
const CFS_BASE = "https://api.afl.com.au/cfs/afl";

/**
 * Hardcoded competition IDs for the AFL API.
 *
 * The `/competitions` endpoint returns multiple entries sharing `code="AFL"`
 * (Premiership, Preseason, Origin, Indigenous All Stars), so we cannot rely
 * on `code` alone to disambiguate. These IDs were verified by probing
 * `/competitions` on 2026-05-06.
 */
const AFL_API_COMP_IDS: Record<CompetitionCode, number> = {
  AFLM: 1,
  AFLW: 3,
  VFL: 7,
  VFLW: 11,
};

/**
 * The `teamType` value used by the AFL API to scope `/teams` queries to
 * the right competition.
 */
const AFL_API_TEAM_TYPES: Record<CompetitionCode, string> = {
  AFLM: "MEN",
  AFLW: "WOMEN",
  VFL: "VFL_MEN",
  VFLW: "VFL_WOMEN",
};

/**
 * Parse a 4-digit year out of a compseason `name` (e.g.
 * "2025 Toyota AFL Premiership" → `2025`). The year is the only place the
 * season's calendar label lives on a compseason object.
 *
 * @param name - The compseason name.
 * @returns The parsed year, or `null` when no 4-digit run is present.
 */
function parseSeasonYear(name: string): number | null {
  const match = name.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
}

/** Cached token with expiry tracking. */
interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

/** Options for constructing an {@link AflApiClient}. */
export interface AflApiClientOptions extends SourceFetchOptions {
  /** Custom fetch implementation (defaults to global `fetch`). */
  readonly fetchFn?: typeof fetch | undefined;
  /** Token endpoint override (useful for testing). */
  readonly tokenUrl?: string | undefined;
}

/**
 * AFL API client that handles token authentication and provides typed fetch helpers.
 *
 * @example
 * ```ts
 * const client = new AflApiClient();
 * await client.authenticate();
 * const result = await client.fetchJson("https://api.afl.com.au/cfs/afl/matchItems/round/123", MatchItemListSchema);
 * ```
 */
export class AflApiClient {
  private readonly fetchFn: typeof fetch;
  private readonly tokenUrl: string;
  private cachedToken: CachedToken | null = null;
  private pendingAuth: Promise<Result<string, AflApiError>> | null = null;

  constructor(options?: AflApiClientOptions) {
    const baseFetch = createSourceFetch(options);
    this.fetchFn = (input, init?) => {
      const headers = new Headers(init?.headers);
      if (!headers.has("User-Agent")) {
        headers.set("User-Agent", USER_AGENT);
      }
      return baseFetch(input, { ...init, headers });
    };
    this.tokenUrl = options?.tokenUrl ?? TOKEN_URL;
  }

  /**
   * Authenticate with the WMCTok token endpoint and cache the token.
   *
   * Concurrent callers share the same in-flight request to avoid
   * redundant token fetches (thundering herd prevention).
   *
   * @returns The access token on success, or an error Result.
   */
  async authenticate(): Promise<Result<string, AflApiError>> {
    if (this.pendingAuth) {
      return this.pendingAuth;
    }
    this.pendingAuth = this.doAuthenticate().finally(() => {
      this.pendingAuth = null;
    });
    return this.pendingAuth;
  }

  private async doAuthenticate(): Promise<Result<string, AflApiError>> {
    try {
      const response = await this.fetchFn(this.tokenUrl, {
        method: "POST",
        headers: { "Content-Length": "0" },
      });

      if (!response.ok) {
        return err(new AflApiError(`Token request failed: ${response.status}`, response.status));
      }

      const json: unknown = await response.json();
      const parsed = AflApiTokenSchema.safeParse(json);

      if (!parsed.success) {
        return err(new AflApiError("Invalid token response format"));
      }

      // Token endpoint doesn't provide expiry; assume 30 minutes.
      const ttlMs = 30 * 60 * 1000;
      this.cachedToken = {
        accessToken: parsed.data.token,
        expiresAt: Date.now() + ttlMs,
      };

      return ok(parsed.data.token);
    } catch (cause) {
      return err(
        new AflApiError(
          `Token request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }
  }

  /**
   * Whether the cached token is still valid (not expired).
   */
  get isAuthenticated(): boolean {
    return this.cachedToken !== null && Date.now() < this.cachedToken.expiresAt;
  }

  /**
   * Perform an authenticated fetch, automatically adding the bearer token.
   * Retries once on 401 by re-authenticating.
   *
   * @param url - The URL to fetch.
   * @param init - Additional fetch options.
   * @returns The Response on success, or an error Result.
   */
  async authedFetch(url: string, init?: RequestInit): Promise<Result<Response, AflApiError>> {
    if (!this.isAuthenticated) {
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return authResult;
      }
    }

    const doFetch = async (): Promise<Response> => {
      const token = this.cachedToken;
      if (!token) {
        throw new AflApiError("No cached token available");
      }
      const headers = new Headers(init?.headers);
      headers.set("x-media-mis-token", token.accessToken);
      return this.fetchFn(url, { ...init, headers });
    };

    try {
      let response = await doFetch();

      if (response.status === 401) {
        const authResult = await this.authenticate();
        if (!authResult.success) {
          return authResult;
        }
        response = await doFetch();
      }

      if (!response.ok) {
        return err(
          new AflApiError(
            `Request failed: ${response.status} ${response.statusText}`,
            response.status,
          ),
        );
      }

      return ok(response);
    } catch (cause) {
      return err(
        new AflApiError(
          `Request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }
  }

  /**
   * Fetch JSON from a URL, validate with a Zod schema, and return a typed Result.
   *
   * @param url - The URL to fetch.
   * @param schema - Zod schema to validate the response against.
   * @returns Validated data on success, or an error Result.
   */
  async fetchJson<T>(
    url: string,
    schema: z.ZodType<T>,
  ): Promise<Result<T, AflApiError | ValidationError>> {
    const isPublic = url.startsWith(API_BASE);

    let response: Response;
    if (isPublic) {
      try {
        response = await this.fetchFn(url);
        if (!response.ok) {
          return err(
            new AflApiError(
              `Request failed: ${response.status} ${response.statusText}`,
              response.status,
            ),
          );
        }
      } catch (cause) {
        return err(
          new AflApiError(
            `Request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
        );
      }
    } else {
      const fetchResult = await this.authedFetch(url);
      if (!fetchResult.success) {
        return fetchResult;
      }
      response = fetchResult.data;
    }

    try {
      const json: unknown = await response.json();
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        return err(
          new ValidationError("Response validation failed", [
            { path: url, message: String(parsed.error) },
          ]),
        );
      }

      return ok(parsed.data);
    } catch (cause) {
      return err(
        new AflApiError(
          `JSON parse failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }
  }

  /**
   * Resolve a competition code (e.g. "AFLM") to its API competition ID.
   *
   * Returns the hardcoded mapping from {@link AFL_API_COMP_IDS}. The previous
   * implementation looked up by `code` field on `/competitions`, but four
   * competitions share `code="AFL"` (Premiership, Preseason, Origin,
   * Indigenous All Stars), so the lookup was load-bearing on response order.
   *
   * @param code - The competition code to resolve.
   * @returns The competition ID on success.
   */
  async resolveCompetitionId(
    code: CompetitionCode,
  ): Promise<Result<number, AflApiError | ValidationError>> {
    return ok(AFL_API_COMP_IDS[code]);
  }

  /**
   * Fetch the compseason list for a competition.
   *
   * Shared by {@link resolveSeasonId} (year → ID lookup) and
   * {@link resolveCurrentSeason} (newest-season detection) so the
   * compseasons URL is defined in exactly one place.
   *
   * @param competitionId - The competition ID (from {@link resolveCompetitionId}).
   * @returns Array of compseason objects on success.
   */
  async fetchCompseasons(
    competitionId: number,
  ): Promise<Result<Compseason[], AflApiError | ValidationError>> {
    const result = await this.fetchJson(
      `${API_BASE}/competitions/${competitionId}/compseasons?pageSize=100`,
      CompseasonListSchema,
    );

    if (!result.success) {
      return result;
    }

    return ok(result.data.compSeasons);
  }

  /** Discover canonical identities from the competition's provider season list. */
  async fetchSeasons(code: CompetitionCode): Promise<Result<CompetitionSeason[], Error>> {
    const competition = await this.resolveCompetitionId(code);
    if (!competition.success) return competition;
    const result = await this.fetchCompseasons(competition.data);
    if (!result.success) return result;
    const seasons: CompetitionSeason[] = [];
    for (const season of result.data) {
      const year = parseSeasonYear(season.name);
      if (year === null) continue;
      const suffix =
        code === "AFLW" && year === 2022 ? /Season ([67])\b/.exec(season.name)?.[1] : undefined;
      if (code === "AFLW" && year === 2022 && !suffix)
        return err(new ValidationError("Unrecognised AFLW 2022 provider season"));
      seasons.push({
        competition: code,
        seasonKey: suffix ? `${year}-S${suffix}` : String(year),
        year,
        displayName: season.name,
        providerSeasonId: season.id,
      });
    }
    return ok(seasons);
  }

  /**
   * Resolve a season (compseason) ID from a competition ID and year.
   *
   * @param competitionId - The competition ID (from {@link resolveCompetitionId}).
   * @param year - The season year (e.g. 2024).
   * @returns The compseason ID string on success.
   */
  async resolveSeasonId(
    competitionId: number,
    year: SeasonSelector,
  ): Promise<Result<number, Error>> {
    const result = await this.fetchCompseasons(competitionId);

    if (!result.success) {
      return result;
    }

    const matches = result.data.filter((cs) => parseSeasonYear(cs.name) === seasonYear(year));
    const key = String(year);
    const season = key.includes("-S")
      ? matches.find((cs) => new RegExp(`Season ${key.slice(-1)}\\b`).test(cs.name))
      : matches.length === 1
        ? matches[0]
        : undefined;
    if (!key.includes("-S") && matches.length > 1) {
      return err(
        new AmbiguousSeasonError(
          String(competitionId),
          seasonYear(year),
          matches.map(
            (cs) => `${seasonYear(year)}-S${/Season (\d+)/.exec(cs.name)?.[1] ?? "unknown"}`,
          ),
        ),
      );
    }
    if (!season) return err(new AflApiError(`Season not found: ${key}`));
    return ok(season.id);
  }

  /**
   * Resolve the *current* default season for a competition from the AFL's
   * round schedule — never from the local calendar year.
   *
   * The compseasons endpoint carries no start/end dates and pre-creates the
   * next season (with a populated `currentRoundNumber`) before it begins, so
   * it cannot answer "which season is current". The rounds endpoint, however,
   * carries `utcStartTime` per round, so the season's start instant is
   * derivable. The rule:
   *
   * 1. Rank compseasons by the 4-digit year in their `name`, newest first.
   * 2. Take the newest season's earliest defined round `utcStartTime` (`S`).
   * 3. If `now >= S`, the newest season has started (in-progress or just
   *    completed) → return the newest year.
   * 4. If `now < S`, the newest season is pre-created but not yet started →
   *    return the previous (most recently completed) year.
   * 5. If `S` is indeterminate (no round carries `utcStartTime`) or any fetch
   *    fails → return a `Result` error so callers can fall back; never guess.
   *
   * @param code - The competition code (e.g. "AFLM").
   * @returns The resolved default season year on success.
   */
  async resolveCurrentSeason(
    code: CompetitionCode,
  ): Promise<Result<SeasonSelector, AflApiError | ValidationError>> {
    const compResult = await this.resolveCompetitionId(code);
    if (!compResult.success) return compResult;

    const seasonsResult = await this.fetchCompseasons(compResult.data);
    if (!seasonsResult.success) return seasonsResult;

    // Rank by the calendar year embedded in each name, newest first.
    const dated = seasonsResult.data
      .map((season) => ({ season, year: parseSeasonYear(season.name) }))
      .filter((entry): entry is { season: Compseason; year: number } => entry.year !== null)
      .sort(
        (a, b) =>
          b.year - a.year ||
          Number(/Season (\d+)/.exec(b.season.name)?.[1] ?? 0) -
            Number(/Season (\d+)/.exec(a.season.name)?.[1] ?? 0),
      );

    const newest = dated[0];
    if (!newest) {
      return err(new AflApiError(`No dated compseasons found for competition: ${code}`));
    }
    for (const candidate of dated) {
      const roundsResult = await this.resolveRounds(candidate.season.id);
      if (!roundsResult.success) return roundsResult;
      const startInstants = roundsResult.data
        .flatMap((round) => (round.utcStartTime ? [new Date(round.utcStartTime).getTime()] : []))
        .filter((instant) => Number.isFinite(instant));
      if (startInstants.length === 0) {
        return err(
          new AflApiError(`Cannot determine season start: no round has utcStartTime (${code})`),
        );
      }
      if (Date.now() >= Math.min(...startInstants)) {
        return currentSelector(code, candidate.season, candidate.year);
      }
    }
    return err(new AflApiError(`No dated season has started (${code})`));
  }

  /**
   * Resolve a season ID from a competition code and year in one step.
   *
   * @param code - The competition code (e.g. "AFLM").
   * @param year - The season year (e.g. 2025).
   * @returns The compseason ID on success.
   */
  async resolveCompSeason(
    code: CompetitionCode,
    year: SeasonSelector,
  ): Promise<Result<number, Error>> {
    const key = canonicalSeasonKey(code, year);
    if (!key.success) return key;
    const compResult = await this.resolveCompetitionId(code);
    if (!compResult.success) return compResult;
    return this.resolveSeasonId(compResult.data, year);
  }

  /**
   * Fetch all rounds for a season with their metadata.
   *
   * @param seasonId - The compseason ID (from {@link resolveSeasonId}).
   * @returns Array of round objects on success.
   */
  async resolveRounds(seasonId: number): Promise<Result<Round[], AflApiError | ValidationError>> {
    const result = await this.fetchJson(
      `${API_BASE}/compseasons/${seasonId}/rounds?pageSize=50`,
      RoundListSchema,
    );

    if (!result.success) {
      return result;
    }

    return ok(result.data.rounds);
  }

  /**
   * Fetch match items for a round using the /cfs/ endpoint.
   *
   * @param roundProviderId - The round provider ID (e.g. "CD_R202501401").
   * @returns Array of match items on success.
   */
  async fetchRoundMatchItems(
    roundProviderId: string,
  ): Promise<Result<MatchItem[], AflApiError | ValidationError>> {
    const result = await this.fetchJson(
      `${CFS_BASE}/matchItems/round/${roundProviderId}`,
      MatchItemListSchema,
    );

    if (!result.success) {
      return result;
    }

    return ok(result.data.items);
  }

  /**
   * Fetch match items for a round by resolving the round provider ID from season and round number.
   *
   * @param seasonId - The compseason ID.
   * @param roundNumber - The round number.
   * @returns Array of match items on success.
   */
  async fetchRoundMatchItemsByNumber(
    seasonId: number,
    roundNumber: number,
  ): Promise<Result<MatchItem[], AflApiError | ValidationError>> {
    const roundsResult = await this.resolveRounds(seasonId);
    if (!roundsResult.success) {
      return roundsResult;
    }

    const round = roundsResult.data.find((r) => r.roundNumber === roundNumber);
    if (!round?.providerId) {
      return err(new AflApiError(`Round not found or missing providerId: round ${roundNumber}`));
    }

    return this.fetchRoundMatchItems(round.providerId);
  }

  /**
   * Fetch match items for all completed rounds in a season.
   *
   * @param seasonId - The compseason ID.
   * @returns Aggregated array of match items from all completed rounds.
   */
  async fetchSeasonMatchItems(
    seasonId: number,
    options?: { includeUpcoming?: boolean },
  ): Promise<Result<MatchItem[], AflApiError | ValidationError>> {
    const roundsResult = await this.resolveRounds(seasonId);
    if (!roundsResult.success) {
      return roundsResult;
    }

    const providerIds = roundsResult.data.flatMap((r) => (r.providerId ? [r.providerId] : []));

    const results = await batchedMap(providerIds, (id) => this.fetchRoundMatchItems(id));

    const includeUpcoming = options?.includeUpcoming ?? false;
    const allItems: MatchItem[] = [];
    for (const result of results) {
      if (!result.success) {
        return result;
      }
      const items = includeUpcoming
        ? result.data
        : result.data.filter(
            (item) => item.match.status === "CONCLUDED" || item.match.status === "COMPLETE",
          );
      allItems.push(...items);
    }

    return ok(allItems);
  }

  /**
   * Fetch per-player statistics for a match.
   *
   * @param matchProviderId - The match provider ID (e.g. "CD_M20250140101").
   * @returns Player stats list with home and away arrays.
   */
  async fetchPlayerStats(
    matchProviderId: string,
  ): Promise<Result<PlayerStatsList, AflApiError | ValidationError>> {
    return this.fetchJson(
      `${CFS_BASE}/playerStats/match/${matchProviderId}`,
      PlayerStatsListSchema,
    );
  }

  /**
   * Fetch match roster (lineup) for a match.
   *
   * @param matchProviderId - The match provider ID (e.g. "CD_M20250140101").
   * @returns Match roster with team players.
   */
  async fetchMatchRoster(
    matchProviderId: string,
  ): Promise<Result<MatchRoster, AflApiError | ValidationError>> {
    return this.fetchJson(`${CFS_BASE}/matchRoster/full/${matchProviderId}`, MatchRosterSchema);
  }

  /**
   * Fetch team list, optionally filtered by competition.
   *
   * Pass a `CompetitionCode` to scope the result to that competition's teams
   * (uses {@link AFL_API_TEAM_TYPES} internally).
   *
   * @param competition - Optional CompetitionCode filter (e.g. "AFLM", "VFL").
   * @returns Array of team items.
   */
  async fetchTeams(
    competition?: CompetitionCode,
  ): Promise<Result<TeamItem[], AflApiError | ValidationError>> {
    const result = await this.fetchJson(`${API_BASE}/teams?pageSize=500`, TeamListSchema);

    if (!result.success) {
      return result;
    }

    if (competition) {
      const teamType = AFL_API_TEAM_TYPES[competition];
      return ok(result.data.teams.filter((t) => t.teamType === teamType));
    }

    return ok(result.data.teams);
  }

  /**
   * Fetch squad (roster) for a team in a specific season.
   *
   * @param teamId - The numeric team ID.
   * @param compSeasonId - The compseason ID.
   * @returns Squad list response.
   */
  async fetchSquad(
    teamId: number,
    compSeasonId: number,
  ): Promise<Result<SquadList, AflApiError | ValidationError>> {
    return this.fetchJson(
      `${API_BASE}/squads?teamId=${teamId}&compSeasonId=${compSeasonId}`,
      SquadListSchema,
    );
  }

  /**
   * Fetch ladder standings for a season (optionally for a specific round).
   *
   * @param seasonId - The compseason ID.
   * @param roundId - Optional round ID (numeric `id`, not `providerId`).
   * @returns Ladder response with entries.
   */
  async fetchLadder(
    seasonId: number,
    roundId?: number,
  ): Promise<Result<LadderResponse, AflApiError | ValidationError>> {
    let url = `${API_BASE}/compseasons/${seasonId}/ladders`;
    if (roundId != null) {
      url += `?roundId=${roundId}`;
    }
    return this.fetchJson(url, LadderResponseSchema);
  }
}

function currentSelector(
  code: CompetitionCode,
  season: Compseason,
  year: number,
): Result<SeasonSelector, ValidationError> {
  if (code === "AFLW" && year === 2022) {
    if (/Season 6\b/.test(season.name)) return ok("2022-S6");
    if (/Season 7\b/.test(season.name)) return ok("2022-S7");
    return err(new ValidationError("Unknown AFLW 2022 provider season"));
  }
  return ok(year);
}
