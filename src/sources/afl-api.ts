/**
 * AFL API client with token authentication and typed fetch helpers.
 *
 * The client handles WMCTok token authentication, automatic 401 retry
 * with re-authentication, and Effect Schema-validated JSON responses.
 * Requests go through {@link SourceHttp}, so tests supply fixtures through
 * layers instead of an injected `fetch`.
 */

import { Clock, Context, Effect, Exit, Layer, Ref, Result, type Schema } from "effect";
import { batched } from "../lib/batched";
import { decodeJson } from "../lib/decode";
import { AflApiError, AmbiguousSeasonError, ValidationError } from "../lib/errors";
import { readJson, type RequestError, SourceHttp, type SourceRequestInit } from "../lib/http";
import { canonicalSeasonKey, seasonYear } from "../lib/seasons";
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
import type { CompetitionCode, CompetitionSeason, SeasonSelector } from "../types";

const decodeToken = decodeJson(AflApiTokenSchema);

/** User-Agent sent with all AFL API requests. Required by the CFS endpoints. */
const USER_AGENT = "fitzroy/2 (https://github.com/jackemcpherson/fitzRoy-ts)";

/** WMCTok token endpoint used by the AFL website. */
const TOKEN_URL = "https://api.afl.com.au/cfs/afl/WMCTok";

/** Base URL for AFL API v2 data endpoints (no auth required). */
const API_BASE = "https://aflapi.afl.com.au/afl/v2";

/** Base URL for /cfs/ endpoints (requires WMCTok token). */
const CFS_BASE = "https://api.afl.com.au/cfs/afl";

/** Token endpoint doesn't provide expiry; assume 30 minutes. */
const TOKEN_TTL_MS = 30 * 60 * 1000;

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

/**
 * Request headers with the AFL API User-Agent added when the caller set none.
 *
 * @param base - Caller headers.
 * @param overrides - Headers that replace any caller value.
 */
function requestHeaders(
  base?: Readonly<Record<string, string>>,
  overrides?: Readonly<Record<string, string>>,
) {
  const headers = new Headers(base);

  if (!headers.has("User-Agent")) headers.set("User-Agent", USER_AGENT);

  for (const [name, value] of Object.entries(overrides ?? {})) headers.set(name, value);

  const record: Record<string, string> = {};

  headers.forEach((value, name) => {
    record[name] = value;
  });

  return record;
}

/** Errors from AFL API season resolution. */
type SeasonError = AflApiError | ValidationError | AmbiguousSeasonError;

/**
 * AFL API client that handles token authentication and provides typed fetch helpers.
 *
 * One token serves every caller for 30 minutes; concurrent callers share a
 * single in-flight token request.
 *
 * @example
 * ```ts
 * const items = yield* (yield* AflApi).fetchRoundMatchItems("CD_R202501401");
 * ```
 */
export class AflApi extends Context.Service<
  AflApi,
  {
    /**
     * Fetch a fresh WMCTok token and cache it. Concurrent callers share the
     * same in-flight request.
     */
    readonly authenticate: Effect.Effect<string, AflApiError>;
    /** Whether a token fetched within the last 30 minutes is cached. */
    readonly isAuthenticated: Effect.Effect<boolean>;
    /**
     * Perform an authenticated request, adding the bearer token.
     * Re-authenticates and retries once on 401.
     */
    readonly authedFetch: (
      url: string,
      init?: SourceRequestInit,
    ) => Effect.Effect<Response, AflApiError>;
    /** Fetch JSON from a URL and validate it with an Effect schema. */
    readonly fetchJson: <S extends Schema.ConstraintDecoder<unknown>>(
      url: string,
      schema: S,
    ) => Effect.Effect<S["Type"], AflApiError | ValidationError>;
    /**
     * Resolve a competition code (e.g. "AFLM") to its API competition ID.
     *
     * Returns the hardcoded mapping from {@link AFL_API_COMP_IDS}: four
     * competitions share `code="AFL"`, so a `/competitions` lookup would be
     * load-bearing on response order.
     */
    readonly resolveCompetitionId: (code: CompetitionCode) => Effect.Effect<number>;
    /** Fetch the compseason list for a competition. */
    readonly fetchCompseasons: (
      competitionId: number,
    ) => Effect.Effect<readonly Compseason[], AflApiError | ValidationError>;
    /** Discover canonical identities from the competition's provider season list. */
    readonly fetchSeasons: (
      code: CompetitionCode,
    ) => Effect.Effect<CompetitionSeason[], AflApiError | ValidationError>;
    /** Resolve a season (compseason) ID from a competition ID and year. */
    readonly resolveSeasonId: (
      competitionId: number,
      year: SeasonSelector,
    ) => Effect.Effect<number, SeasonError>;
    /**
     * Resolve the *current* default season for a competition from the AFL's
     * round schedule — never from the local calendar year.
     *
     * The compseasons endpoint carries no start/end dates and pre-creates the
     * next season before it begins, so the newest season counts only once
     * its earliest round `utcStartTime` has passed. Each season is checked
     * newest first; an indeterminate start or any fetch failure fails so
     * callers can fall back. Never guesses.
     */
    readonly resolveCurrentSeason: (
      code: CompetitionCode,
    ) => Effect.Effect<SeasonSelector, AflApiError | ValidationError>;
    /** Resolve a season ID from a competition code and year in one step. */
    readonly resolveCompSeason: (
      code: CompetitionCode,
      year: SeasonSelector,
    ) => Effect.Effect<number, SeasonError>;
    /** Fetch all rounds for a season with their metadata. */
    readonly resolveRounds: (
      seasonId: number,
    ) => Effect.Effect<readonly Round[], AflApiError | ValidationError>;
    /** Fetch match items for a round using the /cfs/ endpoint. */
    readonly fetchRoundMatchItems: (
      roundProviderId: string,
    ) => Effect.Effect<readonly MatchItem[], AflApiError | ValidationError>;
    /** Fetch match items for a round, resolving its provider ID from the round number. */
    readonly fetchRoundMatchItemsByNumber: (
      seasonId: number,
      roundNumber: number,
    ) => Effect.Effect<readonly MatchItem[], AflApiError | ValidationError>;
    /** Fetch match items for every round in a season (completed matches only by default). */
    readonly fetchSeasonMatchItems: (
      seasonId: number,
      options?: { includeUpcoming?: boolean },
    ) => Effect.Effect<readonly MatchItem[], AflApiError | ValidationError>;
    /** Fetch per-player statistics for a match. */
    readonly fetchPlayerStats: (
      matchProviderId: string,
    ) => Effect.Effect<PlayerStatsList, AflApiError | ValidationError>;
    /** Fetch the match roster (lineup) for a match. */
    readonly fetchMatchRoster: (
      matchProviderId: string,
    ) => Effect.Effect<MatchRoster, AflApiError | ValidationError>;
    /** Fetch the team list, optionally scoped to one competition. */
    readonly fetchTeams: (
      competition?: CompetitionCode,
    ) => Effect.Effect<readonly TeamItem[], AflApiError | ValidationError>;
    /** Fetch the squad (roster) for a team in a specific season. */
    readonly fetchSquad: (
      teamId: number,
      compSeasonId: number,
    ) => Effect.Effect<SquadList, AflApiError | ValidationError>;
    /** Fetch ladder standings for a season, optionally for one round (numeric `id`). */
    readonly fetchLadder: (
      seasonId: number,
      roundId?: number,
    ) => Effect.Effect<LadderResponse, AflApiError | ValidationError>;
  }
>()("fitzroy/AflApi") {}

/** The live AFL API client over {@link SourceHttp}. */
export const AflApiLive = Layer.effect(
  AflApi,
  Effect.gen(function* () {
    const http = yield* SourceHttp;
    const tokenExpiresAt = yield* Ref.make(0);

    const requestToken = Effect.gen(function* () {
      const response = yield* http.request(TOKEN_URL, {
        method: "POST",
        headers: requestHeaders({ "Content-Length": "0" }),
      });

      if (!response.ok) {
        return yield* Effect.fail(
          new AflApiError({
            message: `Token request failed: ${response.status}`,
            statusCode: response.status,
          }),
        );
      }

      const json = yield* readJson(response);

      const parsed = yield* decodeToken(json).pipe(
        Effect.mapError(() => new AflApiError({ message: "Invalid token response format" })),
      );

      const now = yield* Clock.currentTimeMillis;

      yield* Ref.set(tokenExpiresAt, now + TOKEN_TTL_MS);

      return parsed.token;
    }).pipe(
      Effect.catchTag("RequestError", (error) =>
        Effect.fail(new AflApiError({ message: `Token request failed: ${error.message}` })),
      ),
    );

    // One token per 30 minutes for every caller; failures are not cached.
    const [cachedToken, invalidateToken] = yield* Effect.cachedInvalidateWithTTL(
      requestToken,
      (exit) => (Exit.isSuccess(exit) ? TOKEN_TTL_MS : 0),
    );

    const authenticate = Effect.andThen(invalidateToken, cachedToken);

    const requestFailed = (response: Response) =>
      new AflApiError({
        message: `Request failed: ${response.status} ${response.statusText}`,
        statusCode: response.status,
      });

    const networkFailed = <A>(
      self: Effect.Effect<A, AflApiError | RequestError>,
    ): Effect.Effect<A, AflApiError> =>
      self.pipe(
        Effect.catchTag("RequestError", (error) =>
          Effect.fail(new AflApiError({ message: `Request failed: ${error.message}` })),
        ),
      );

    const authedFetch = (url: string, init?: SourceRequestInit) => {
      const send = (token: string) =>
        http
          .request(url, {
            ...init,
            headers: requestHeaders(init?.headers, { "x-media-mis-token": token }),
          })
          .pipe(networkFailed);

      return Effect.gen(function* () {
        const first = yield* send(yield* cachedToken);
        const response = first.status === 401 ? yield* send(yield* authenticate) : first;

        if (!response.ok) return yield* Effect.fail(requestFailed(response));

        return response;
      });
    };

    const publicFetch = (url: string) =>
      Effect.gen(function* () {
        const response = yield* http.request(url, { headers: requestHeaders() });

        if (!response.ok) return yield* Effect.fail(requestFailed(response));

        return response;
      }).pipe(networkFailed);

    const fetchJson = <S extends Schema.ConstraintDecoder<unknown>>(url: string, schema: S) =>
      Effect.gen(function* () {
        const response = url.startsWith(API_BASE)
          ? yield* publicFetch(url)
          : yield* authedFetch(url);

        const json = yield* readJson(response).pipe(
          Effect.mapError(
            (error) => new AflApiError({ message: `JSON parse failed: ${error.message}` }),
          ),
        );

        return yield* decodeJson(schema)(json).pipe(
          Effect.mapError(
            (message) =>
              new ValidationError({
                message: "Response validation failed",
                issues: [{ path: url, message }],
              }),
          ),
        );
      });

    const resolveCompetitionId = (code: CompetitionCode) => Effect.succeed(AFL_API_COMP_IDS[code]);

    const fetchCompseasons = (competitionId: number) =>
      fetchJson(
        `${API_BASE}/competitions/${competitionId}/compseasons?pageSize=100`,
        CompseasonListSchema,
      ).pipe(Effect.map((data): readonly Compseason[] => data.compSeasons));

    const resolveRounds = (seasonId: number) =>
      fetchJson(`${API_BASE}/compseasons/${seasonId}/rounds?pageSize=50`, RoundListSchema).pipe(
        Effect.map((data): readonly Round[] => data.rounds),
      );

    const fetchRoundMatchItems = (roundProviderId: string) =>
      fetchJson(`${CFS_BASE}/matchItems/round/${roundProviderId}`, MatchItemListSchema).pipe(
        Effect.map((data): readonly MatchItem[] => data.items),
      );

    const resolveSeasonId = (competitionId: number, year: SeasonSelector) =>
      Effect.gen(function* () {
        const compseasons = yield* fetchCompseasons(competitionId);
        const matches = compseasons.filter((cs) => parseSeasonYear(cs.name) === seasonYear(year));
        const key = String(year);

        const season = key.includes("-S")
          ? matches.find((cs) => new RegExp(`Season ${key.slice(-1)}\\b`).test(cs.name))
          : matches.length === 1
            ? matches[0]
            : undefined;

        if (!key.includes("-S") && matches.length > 1) {
          return yield* Effect.fail(
            new AmbiguousSeasonError({
              competition: String(competitionId),
              year: seasonYear(year),
              validSelectors: matches.map(
                (cs) => `${seasonYear(year)}-S${/Season (\d+)/.exec(cs.name)?.[1] ?? "unknown"}`,
              ),
            }),
          );
        }

        if (!season)
          return yield* Effect.fail(new AflApiError({ message: `Season not found: ${key}` }));

        return season.id;
      });

    return {
      authenticate,
      isAuthenticated: Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        return now < (yield* Ref.get(tokenExpiresAt));
      }),
      authedFetch,
      fetchJson,
      resolveCompetitionId,
      fetchCompseasons,
      fetchSeasons: (code) =>
        Effect.gen(function* () {
          const competitionId = yield* resolveCompetitionId(code);
          const compseasons = yield* fetchCompseasons(competitionId);

          return yield* Effect.fromResult(seasonsFromCompseasons(code, compseasons));
        }),
      resolveSeasonId,
      resolveCurrentSeason: (code) =>
        Effect.gen(function* () {
          const competitionId = yield* resolveCompetitionId(code);
          const compseasons = yield* fetchCompseasons(competitionId);

          // Rank by the calendar year embedded in each name, newest first.
          const dated = compseasons
            .map((season) => ({ season, year: parseSeasonYear(season.name) }))
            .filter((entry): entry is { season: Compseason; year: number } => entry.year !== null)
            .sort(
              (a, b) =>
                b.year - a.year ||
                Number(/Season (\d+)/.exec(b.season.name)?.[1] ?? 0) -
                  Number(/Season (\d+)/.exec(a.season.name)?.[1] ?? 0),
            );

          if (dated.length === 0) {
            return yield* Effect.fail(
              new AflApiError({ message: `No dated compseasons found for competition: ${code}` }),
            );
          }

          for (const candidate of dated) {
            const rounds = yield* resolveRounds(candidate.season.id);

            const startInstants = rounds
              .flatMap((round) =>
                round.utcStartTime ? [new Date(round.utcStartTime).getTime()] : [],
              )
              .filter((instant) => Number.isFinite(instant));

            if (startInstants.length === 0) {
              return yield* Effect.fail(
                new AflApiError({
                  message: `Cannot determine season start: no round has utcStartTime (${code})`,
                }),
              );
            }

            if (Date.now() >= Math.min(...startInstants)) {
              return yield* Effect.fromResult(
                currentSelector(code, candidate.season, candidate.year),
              );
            }
          }

          return yield* Effect.fail(
            new AflApiError({ message: `No dated season has started (${code})` }),
          );
        }),
      resolveCompSeason: (code, year) =>
        Effect.gen(function* () {
          yield* Effect.fromResult(canonicalSeasonKey(code, year));
          const competitionId = yield* resolveCompetitionId(code);

          return yield* resolveSeasonId(competitionId, year);
        }),
      resolveRounds,
      fetchRoundMatchItems,
      fetchRoundMatchItemsByNumber: (seasonId, roundNumber) =>
        Effect.gen(function* () {
          const rounds = yield* resolveRounds(seasonId);
          const round = rounds.find((r) => r.roundNumber === roundNumber);

          if (!round?.providerId) {
            return yield* Effect.fail(
              new AflApiError({
                message: `Round not found or missing providerId: round ${roundNumber}`,
              }),
            );
          }

          return yield* fetchRoundMatchItems(round.providerId);
        }),
      fetchSeasonMatchItems: (seasonId, options) =>
        Effect.gen(function* () {
          const rounds = yield* resolveRounds(seasonId);
          const providerIds = rounds.flatMap((r) => (r.providerId ? [r.providerId] : []));

          // Every round is fetched; the first failure in round order is reported.
          const results = yield* batched(providerIds, (id) =>
            Effect.result(fetchRoundMatchItems(id)),
          );

          const includeUpcoming = options?.includeUpcoming ?? false;
          const allItems: MatchItem[] = [];

          for (const result of results) {
            if (Result.isFailure(result)) return yield* Effect.fail(result.failure);

            const items = includeUpcoming
              ? result.success
              : result.success.filter(
                  (item) => item.match.status === "CONCLUDED" || item.match.status === "COMPLETE",
                );

            allItems.push(...items);
          }

          return allItems;
        }),
      fetchPlayerStats: (matchProviderId) =>
        fetchJson(`${CFS_BASE}/playerStats/match/${matchProviderId}`, PlayerStatsListSchema),
      fetchMatchRoster: (matchProviderId) =>
        fetchJson(`${CFS_BASE}/matchRoster/full/${matchProviderId}`, MatchRosterSchema),
      fetchTeams: (competition) =>
        fetchJson(`${API_BASE}/teams?pageSize=500`, TeamListSchema).pipe(
          Effect.map((data): readonly TeamItem[] => {
            if (!competition) return data.teams;
            const teamType = AFL_API_TEAM_TYPES[competition];

            return data.teams.filter((t) => t.teamType === teamType);
          }),
        ),
      fetchSquad: (teamId, compSeasonId) =>
        fetchJson(
          `${API_BASE}/squads?teamId=${teamId}&compSeasonId=${compSeasonId}`,
          SquadListSchema,
        ),
      fetchLadder: (seasonId, roundId) => {
        const base = `${API_BASE}/compseasons/${seasonId}/ladders`;
        const url = roundId == null ? base : `${base}?roundId=${roundId}`;

        return fetchJson(url, LadderResponseSchema);
      },
    };
  }),
);

/** Map provider compseasons to canonical competition seasons. */
function seasonsFromCompseasons(
  code: CompetitionCode,
  compseasons: readonly Compseason[],
): Result.Result<CompetitionSeason[], ValidationError> {
  const seasons: CompetitionSeason[] = [];

  for (const season of compseasons) {
    const year = parseSeasonYear(season.name);

    if (year === null) continue;

    const suffix =
      code === "AFLW" && year === 2022 ? /Season ([67])\b/.exec(season.name)?.[1] : undefined;

    if (code === "AFLW" && year === 2022 && !suffix)
      return Result.fail(
        new ValidationError({ message: "Unrecognised AFLW 2022 provider season" }),
      );
    seasons.push({
      competition: code,
      seasonKey: suffix ? `${year}-S${suffix}` : String(year),
      year,
      displayName: season.name,
      providerSeasonId: season.id,
    });
  }

  return Result.succeed(seasons);
}

/** The selector for a started season, splitting AFLW 2022 into its two provider seasons. */
function currentSelector(
  code: CompetitionCode,
  season: Compseason,
  year: number,
): Result.Result<SeasonSelector, ValidationError> {
  if (code === "AFLW" && year === 2022) {
    if (/Season 6\b/.test(season.name)) return Result.succeed("2022-S6");

    if (/Season 7\b/.test(season.name)) return Result.succeed("2022-S7");

    return Result.fail(new ValidationError({ message: "Unknown AFLW 2022 provider season" }));
  }

  return Result.succeed(year);
}
