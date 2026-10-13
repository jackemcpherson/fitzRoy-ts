/**
 * FootyWire source adapters.
 *
 * FootyWire is AFLM-only (no AFLW or VFL coverage). Each capability has
 * its own adapter so per-capability coverage stays accurate.
 */

import { Effect, Result } from "effect";
import { batched } from "../../lib/batched";
import { seasonYear } from "../../lib/seasons";
import { normaliseTeamName } from "../../lib/team-mapping";
import type { MatchCoachAssignment, Player, PlayerStats } from "../../types";
import { FootyWire } from "../footywire";
import { MatchCoaches } from "../match-coaches";
import type {
  MatchCoachesSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
  TeamStatsSource,
} from "./capabilities";
import type { CoverageMap } from "./coverage";

const FOOTYWIRE_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);

const FOOTYWIRE_PLAYER_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);

const FOOTYWIRE_TEAM_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);

const FOOTYWIRE_SQUAD_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);

// No season-wide coach-heading scope is registered until captured pages establish it.
const FOOTYWIRE_MATCH_COACHES_COVERAGE: CoverageMap = new Map();

/** FootyWire match-page coach headings for explicit comparison requests. */
export const footyWireMatchCoachesSource: Effect.Effect<
  MatchCoachesSource,
  never,
  FootyWire | MatchCoaches
> = Effect.gen(function* () {
  const matchClient = yield* FootyWire;
  const coachClient = yield* MatchCoaches;

  return {
    id: "footywire",
    coverage: FOOTYWIRE_MATCH_COACHES_COVERAGE,
    fetchMatchCoaches: (query) =>
      Effect.gen(function* () {
        const matches = yield* matchClient.fetchSeasonFixture(
          seasonYear(query.season),
          query.competition ?? "AFLM",
        );

        const records = yield* coachClient.fetchFootyWireMatches(matches);

        const assignments: MatchCoachAssignment[] = records.assignments.filter(
          (assignment) =>
            query.team === undefined ||
            normaliseTeamName(assignment.team) === normaliseTeamName(query.team),
        );

        return {
          assignments,
          completeness: { complete: records.failures.length === 0, failures: records.failures },
        };
      }),
  };
});

/** FootyWire as a MatchSource (AFLM only, ~2010+). */
export const footyWireMatchSource: Effect.Effect<MatchSource, never, FootyWire> = Effect.gen(
  function* () {
    const client = yield* FootyWire;

    return {
      id: "footywire",
      coverage: FOOTYWIRE_MATCH_COVERAGE,
      fetchMatches: (query) =>
        // fetchSeasonFixture returns ALL matches (any status). fetchSeasonResults
        // returns only completed. Use the broader call so the api-layer status
        // filter applies uniformly across sources.
        client
          .fetchSeasonFixture(seasonYear(query.season), query.competition ?? "AFLM")
          .pipe(
            Effect.map((matches) =>
              query.round != null ? matches.filter((m) => m.roundNumber === query.round) : matches,
            ),
          ),
    };
  },
);

/**
 * FootyWire as a PlayerStatsSource (AFLM only, ~2010+).
 *
 * Scrapes per-match stats in batches of 5 with a delay between batches to
 * be respectful to the FootyWire site. Individual match failures don't
 * abort the scrape — they are surfaced in the envelope's `failedMatchIds`
 * (same `FW_…` namespace as the stat rows).
 */
export const footyWirePlayerStatsSource: Effect.Effect<PlayerStatsSource, never, FootyWire> =
  Effect.gen(function* () {
    const client = yield* FootyWire;

    return {
      id: "footywire",
      coverage: FOOTYWIRE_PLAYER_STATS_COVERAGE,
      fetchPlayerStats: (query) =>
        Effect.gen(function* () {
          const season = seasonYear(query.season);
          const ids = yield* client.fetchSeasonMatchIds(season);

          const entries =
            query.round != null ? ids.filter((e) => e.roundNumber === query.round) : ids;

          if (entries.length === 0) return { stats: [], failedMatchIds: [] };

          const results = yield* batched(
            entries,
            (e) => Effect.result(client.fetchMatchPlayerStats(e.matchId, season, e.roundNumber)),
            { batchSize: 5, gap: "500 millis" },
          );

          const allStats: PlayerStats[] = [];
          const failedMatchIds: string[] = [];

          results.forEach((result, i) => {
            const entry = entries[i];

            if (Result.isSuccess(result)) {
              allStats.push(...result.success);
            } else if (entry) {
              failedMatchIds.push(`FW_${entry.matchId}`);
            }
          });

          return { stats: allStats, failedMatchIds };
        }),
    };
  });

/** FootyWire as a SquadSource (AFLM only — scrapes the team history page). */
export const footyWireSquadSource: Effect.Effect<SquadSource, never, FootyWire> = Effect.gen(
  function* () {
    const client = yield* FootyWire;

    return {
      id: "footywire",
      coverage: FOOTYWIRE_SQUAD_COVERAGE,
      fetchSquad: (query) => {
        const competition = query.competition ?? "AFLM";
        const teamName = normaliseTeamName(query.team);

        return client.fetchPlayerList(teamName).pipe(
          Effect.map((details) => {
            const players: Player[] = details.map((p) => ({
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
              source: "footywire",
              competition,
            }));

            return {
              teamId: teamName,
              teamName,
              season: seasonYear(query.season),
              scope: "all-time" as const,
              players,
              competition,
              source: "footywire" as const,
            };
          }),
        );
      },
    };
  },
);

/** FootyWire as a TeamStatsSource (AFLM only). */
export const footyWireTeamStatsSource: Effect.Effect<TeamStatsSource, never, FootyWire> =
  Effect.gen(function* () {
    const client = yield* FootyWire;

    return {
      id: "footywire",
      coverage: FOOTYWIRE_TEAM_STATS_COVERAGE,
      fetchTeamStats: (query) =>
        client.fetchTeamStats(seasonYear(query.season), query.summaryType ?? "totals"),
    };
  });
