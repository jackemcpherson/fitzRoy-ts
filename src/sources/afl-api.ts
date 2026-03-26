/**
 * AFL API client with token authentication and typed fetch helpers.
 *
 * The client handles WMCTok token authentication, automatic 401 retry
 * with re-authentication, and Zod-validated JSON responses.
 *
 * Accepts an injectable `fetch` function for testability.
 */

import type { z } from "zod/v4";
import { AflApiError, ValidationError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import {
  AflApiTokenSchema,
  CompetitionListSchema,
  CompseasonListSchema,
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

/** WMCTok token endpoint used by the AFL website. */
const TOKEN_URL = "https://api.afl.com.au/cfs/afl/WMCTok";

/** Base URL for AFL API v2 data endpoints (no auth required). */
const API_BASE = "https://aflapi.afl.com.au/afl/v2";

/** Base URL for /cfs/ endpoints (requires WMCTok token). */
const CFS_BASE = "https://api.afl.com.au/cfs/afl";

/** Cached token with expiry tracking. */
interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

/** Options for constructing an {@link AflApiClient}. */
export interface AflApiClientOptions {
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

  constructor(options?: AflApiClientOptions) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.tokenUrl = options?.tokenUrl ?? TOKEN_URL;
  }

  /**
   * Authenticate with the WMCTok token endpoint and cache the token.
   *
   * @returns The access token on success, or an error Result.
   */
  async authenticate(): Promise<Result<string, AflApiError>> {
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
   * @param code - The competition code to resolve.
   * @returns The competition ID string on success.
   */
  async resolveCompetitionId(
    code: CompetitionCode,
  ): Promise<Result<number, AflApiError | ValidationError>> {
    const result = await this.fetchJson(
      `${API_BASE}/competitions?pageSize=50`,
      CompetitionListSchema,
    );

    if (!result.success) {
      return result;
    }

    // The API uses "AFL" for AFLM; map our domain code to the API code.
    const apiCode = code === "AFLM" ? "AFL" : code;
    const competition = result.data.competitions.find((c) => c.code === apiCode);

    if (!competition) {
      return err(new AflApiError(`Competition not found for code: ${code}`));
    }

    return ok(competition.id);
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
    year: number,
  ): Promise<Result<number, AflApiError | ValidationError>> {
    const result = await this.fetchJson(
      `${API_BASE}/competitions/${competitionId}/compseasons?pageSize=100`,
      CompseasonListSchema,
    );

    if (!result.success) {
      return result;
    }

    const yearStr = String(year);
    const season = result.data.compSeasons.find((cs) => cs.name.includes(yearStr));

    if (!season) {
      return err(new AflApiError(`Season not found for year: ${year}`));
    }

    return ok(season.id);
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
    year: number,
  ): Promise<Result<number, AflApiError | ValidationError>> {
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
  ): Promise<Result<MatchItem[], AflApiError | ValidationError>> {
    const roundsResult = await this.resolveRounds(seasonId);
    if (!roundsResult.success) {
      return roundsResult;
    }

    const providerIds = roundsResult.data.flatMap((r) => (r.providerId ? [r.providerId] : []));

    const results = await Promise.all(providerIds.map((id) => this.fetchRoundMatchItems(id)));

    const allItems: MatchItem[] = [];
    for (const result of results) {
      if (!result.success) {
        return result;
      }
      const concluded = result.data.filter(
        (item) => item.match.status === "CONCLUDED" || item.match.status === "COMPLETE",
      );
      allItems.push(...concluded);
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
   * Fetch team list, optionally filtered by team type.
   *
   * @param teamType - Optional filter (e.g. "MEN", "WOMEN").
   * @returns Array of team items.
   */
  async fetchTeams(teamType?: string): Promise<Result<TeamItem[], AflApiError | ValidationError>> {
    const result = await this.fetchJson(`${API_BASE}/teams?pageSize=100`, TeamListSchema);

    if (!result.success) {
      return result;
    }

    if (teamType) {
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
}
