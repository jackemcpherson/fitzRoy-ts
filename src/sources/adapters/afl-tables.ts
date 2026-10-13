import { seasonYear } from "../../lib/seasons";
/**
 * AFL Tables source adapters.
 *
 * AFL Tables is AFLM-only. Match results go back to 1897; player stats
 * start ~1965. Other capabilities (TeamStats, Ladder via compute) declare
 * their own coverage in their own classes.
 */

import { Effect, Result } from "effect";
import { ScrapeError } from "../../lib/errors";
import { normaliseTeamName } from "../../lib/team-mapping";
import { computeLadder } from "../../transforms/computed-ladder";
import type { MatchCoachAssignment, Player, TeamStatsEntry } from "../../types";
import { AflTables } from "../afl-tables";
import { MatchCoaches } from "../match-coaches";
import type {
  LadderSource,
  MatchCoachesSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
  TeamStatsSource,
} from "./capabilities";
import type { CoverageMap } from "./coverage";

const AFL_TABLES_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);

const AFL_TABLES_PLAYER_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1965 }]]);

const AFL_TABLES_TEAM_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1965 }]]);

const AFL_TABLES_LADDER_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);

const AFL_TABLES_SQUAD_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);

const AFL_TABLES_MATCH_COACHES_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1990 }]]);

/** AFL Tables as the primary credited match-coach source (AFLM 1990+). */
export const aflTablesMatchCoachesSource: Effect.Effect<MatchCoachesSource, never, MatchCoaches> =
  Effect.gen(function* () {
    const client = yield* MatchCoaches;

    return {
      id: "afl-tables",
      coverage: AFL_TABLES_MATCH_COACHES_COVERAGE,
      fetchMatchCoaches: (query) =>
        client.fetchAflTablesSeason(seasonYear(query.season), query.batch).pipe(
          Effect.map((data) => {
            const assignments: MatchCoachAssignment[] = data.assignments.filter(
              (assignment) =>
                query.team === undefined ||
                normaliseTeamName(assignment.team) === normaliseTeamName(query.team),
            );

            const failures = data.failures;

            return {
              assignments,
              completeness: { complete: failures.length === 0, failures },
              ...(data.batch && { batch: data.batch }),
            };
          }),
        ),
    };
  });

/** AFL Tables as a MatchSource (AFLM only, 1897+). */
export const aflTablesMatchSource: Effect.Effect<MatchSource, never, AflTables> = Effect.gen(
  function* () {
    const client = yield* AflTables;

    return {
      id: "afl-tables",
      coverage: AFL_TABLES_MATCH_COVERAGE,
      fetchMatches: (query) =>
        client
          .fetchSeasonResults(seasonYear(query.season))
          .pipe(
            Effect.map((matches) =>
              query.round != null ? matches.filter((m) => m.roundNumber === query.round) : matches,
            ),
          ),
    };
  },
);

/** AFL Tables as a PlayerStatsSource (AFLM only, ~1965+). */
export const aflTablesPlayerStatsSource: Effect.Effect<PlayerStatsSource, never, AflTables> =
  Effect.gen(function* () {
    const client = yield* AflTables;

    return {
      id: "afl-tables",
      coverage: AFL_TABLES_PLAYER_STATS_COVERAGE,
      fetchPlayerStats: (query) =>
        client.fetchSeasonPlayerStats(seasonYear(query.season)).pipe(
          Effect.map((season) => {
            if (query.round == null) return season;

            // failedMatchIds pass through unfiltered — a failed game's round is
            // unknown, so callers see every season-scrape failure regardless of
            // the round filter.
            return {
              stats: season.stats.filter((s) => s.roundNumber === query.round),
              failedMatchIds: season.failedMatchIds,
            };
          }),
        ),
    };
  });

/** AFL Tables as a TeamStatsSource. */
export const aflTablesTeamStatsSource: Effect.Effect<TeamStatsSource, never, AflTables> =
  Effect.gen(function* () {
    const client = yield* AflTables;

    return {
      id: "afl-tables",
      coverage: AFL_TABLES_TEAM_STATS_COVERAGE,
      fetchTeamStats: (query) =>
        Effect.gen(function* () {
          const summaryType = query.summaryType ?? "totals";
          const stats = yield* client.fetchTeamStats(seasonYear(query.season));

          // The stats page lacks a GP column — derive from match results if needed.
          const needsGp = stats.some((entry) => entry.gamesPlayed === null);
          const gpMap = new Map<string, number>();

          if (needsGp) {
            const results = yield* Effect.result(
              client.fetchSeasonResults(seasonYear(query.season)),
            );

            if (Result.isSuccess(results)) {
              for (const m of results.success) {
                const home = normaliseTeamName(m.homeTeam);
                const away = normaliseTeamName(m.awayTeam);
                gpMap.set(home, (gpMap.get(home) ?? 0) + 1);
                gpMap.set(away, (gpMap.get(away) ?? 0) + 1);
              }
            }
          }

          const enriched = stats.map((entry) => ({
            ...entry,
            gamesPlayed: gpMap.get(normaliseTeamName(entry.team)) ?? entry.gamesPlayed,
          }));

          if (summaryType === "averages") {
            const invalid = enriched.filter(
              (entry) => entry.gamesPlayed === null || entry.gamesPlayed <= 0,
            );

            if (invalid.length > 0) {
              return yield* Effect.fail(
                new ScrapeError({
                  message: `Cannot calculate team-stat averages because games played is missing or non-positive for: ${invalid.map((entry) => entry.team).join(", ")}`,
                  source: "afl-tables",
                }),
              );
            }

            return enriched.map((entry) => averageMetrics(entry));
          }

          return enriched;
        }),
    };
  });

/** Convert a TeamStatsEntry's `for`/`against` totals into per-game averages. */
function averageMetrics(entry: TeamStatsEntry): TeamStatsEntry {
  const gamesPlayed = entry.gamesPlayed;

  if (gamesPlayed === null || gamesPlayed <= 0) return entry;

  const divide = (set: TeamStatsEntry["for"]): TeamStatsEntry["for"] => {
    const out = { ...set };

    // SAFETY: `out` is a shallow copy of a TeamMetricSet, so its own keys are
    // exactly the TeamMetricSet keys.
    for (const key of Object.keys(out) as (keyof typeof out)[]) {
      const v = out[key];

      if (v != null) {
        out[key] = +(v / gamesPlayed).toFixed(1);
      }
    }

    return out;
  };

  return { ...entry, for: divide(entry.for), against: divide(entry.against) };
}

/**
 * AFL Tables as a SquadSource — scrapes the team page for the **all-time
 * roster**, NOT a per-season squad. AFL Tables doesn't publish per-season
 * squad lists, so the `season` field is stamped onto the response for
 * cross-source compatibility but does not actually filter the player list.
 *
 * **Caveat for callers (#88):** asking for `season: 1900` and `season: 2024`
 * returns the same all-time list. If you need an accurate seasonal squad,
 * use `--source afl-api` (2012+ only). For pre-2012 seasons the all-time
 * roster is the only available proxy.
 */
export const aflTablesSquadSource: Effect.Effect<SquadSource, never, AflTables> = Effect.gen(
  function* () {
    const client = yield* AflTables;

    return {
      id: "afl-tables",
      coverage: AFL_TABLES_SQUAD_COVERAGE,
      fetchSquad: (query) => {
        const competition = query.competition ?? "AFLM";
        const teamName = normaliseTeamName(query.team);

        return client.fetchPlayerList(teamName).pipe(
          Effect.map((list) => {
            const players: Player[] = list.map((p) => ({
              playerId: p.playerId,
              givenName: p.givenName,
              surname: p.surname,
              displayName: p.displayName,
              jumperNumber: p.jumperNumber,
              position: p.position,
              dateOfBirth: p.dateOfBirth ?? null,
              heightCm: p.heightCm,
              weightKg: p.weightKg,
              draftYear: p.draftYear,
              draftPosition: p.draftPosition,
              draftType: p.draftType,
              debutYear: p.debutYear,
              recruitedFrom: p.recruitedFrom,
              gamesPlayed: p.gamesPlayed ?? null,
              goals: p.goals ?? null,
              team: teamName,
              source: "afl-tables",
              competition,
            }));

            return {
              teamId: teamName,
              teamName,
              season: seasonYear(query.season),
              scope: "all-time" as const,
              players,
              competition,
              source: "afl-tables" as const,
            };
          }),
        );
      },
    };
  },
);

/**
 * AFL Tables as a LadderSource — *computed* from match results.
 *
 * AFL Tables doesn't publish a ladder endpoint, but match results go back
 * to 1897, so we can synthesise the ladder by accumulating wins/losses/etc.
 * via {@link computeLadder}. Coverage matches the match-results coverage.
 */
export const aflTablesLadderSource: Effect.Effect<LadderSource, never, AflTables> = Effect.gen(
  function* () {
    const client = yield* AflTables;

    return {
      id: "afl-tables",
      coverage: AFL_TABLES_LADDER_COVERAGE,
      fetchLadder: (query) => {
        const competition = query.competition ?? "AFLM";

        return client.fetchSeasonResults(seasonYear(query.season)).pipe(
          Effect.map((results) => {
            const entries = computeLadder(results, query.round ?? undefined);
            // Surface the most-recent completed match feeding the synthesised
            // ladder so mid-round snapshots are pinned to a specific cutoff (#119).
            const roundCutoff = query.round;

            const inScope =
              roundCutoff != null ? results.filter((m) => m.roundNumber <= roundCutoff) : results;

            const completed = inScope.filter((m) => m.status === "Complete");
            completed.sort((a, b) => b.date.getTime() - a.date.getTime());
            const asOfMatch = completed[0]?.matchId ?? null;

            return {
              season: seasonYear(query.season),
              roundNumber: query.round ?? null,
              entries,
              competition,
              source: "afl-tables" as const,
              asOfMatch,
            };
          }),
        );
      },
    };
  },
);
