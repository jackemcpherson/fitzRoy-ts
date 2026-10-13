/**
 * AFL API source adapters.
 *
 * One adapter per capability (Match, PlayerStats, Squad, Lineup, Ladder)
 * because each capability has its own coverage map. AFL API supports the
 * same season ranges across all of its operations, but per-capability
 * adapters keep the design uniform with sources whose coverage *does* vary
 * per operation (e.g., AFL Tables: matches from 1897, stats from ~1965).
 */

import { Effect, Result } from "effect";
import { batched } from "../../lib/batched";
import { parseDate } from "../../lib/date-utils";
import { AflApiError, ValidationError } from "../../lib/errors";
import { safeInt } from "../../lib/parse-utils";
import { seasonYear } from "../../lib/seasons";
import { AFL_API_TEAM_IDS, normaliseTeamName } from "../../lib/team-mapping";
import type { MatchItem } from "../../lib/validation";
import { transformLadderEntries } from "../../transforms/ladder";
import { transformMatchRoster } from "../../transforms/lineup";
import { inferRoundType, transformMatchItems } from "../../transforms/match-results";
import { transformPlayerStats } from "../../transforms/player-stats";
import type { CompetitionCode, Lineup, Player, PlayerStats, SeasonSelector } from "../../types";
import { AflApi } from "../afl-api";
import type {
  LadderSource,
  LineupSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
} from "./capabilities";
import type { CoverageMap } from "./coverage";

/** Per-capability coverage shared by every AFL API capability. */
const AFL_API_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 2012 }],
  ["AFLW", { minSeason: 2017 }],
  ["VFL", { minSeason: 2021 }],
  ["VFLW", { minSeason: 2021 }],
]);

/**
 * Find a match in its season's full inventory, failing when it is not in
 * the competition season or not in the requested round.
 */
function findSeasonMember(
  client: AflApi["Service"],
  query: {
    readonly competition: CompetitionCode;
    readonly season: SeasonSelector;
    readonly round?: number | undefined;
    readonly matchId: string;
  },
) {
  return Effect.gen(function* () {
    const scope = yield* client.resolveCompSeason(query.competition, query.season);
    const inventory = yield* client.fetchSeasonMatchItems(scope, { includeUpcoming: true });
    const member = inventory.find((item) => item.match.matchId === query.matchId);

    if (!member || (query.round !== undefined && member.round?.roundNumber !== query.round)) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Match ${query.matchId} does not belong to ${query.competition} ${query.season} within the requested round`,
        }),
      );
    }

    return member;
  });
}

/** AFL API as a MatchSource. */
export const aflApiMatchSource: Effect.Effect<MatchSource, never, AflApi> = Effect.gen(
  function* () {
    const client = yield* AflApi;

    return {
      id: "afl-api",
      coverage: AFL_API_COVERAGE,
      fetchMatches: (query) =>
        Effect.gen(function* () {
          const competition = query.competition ?? "AFLM";
          const seasonId = yield* client.resolveCompSeason(competition, query.season);
          const includeUpcoming = query.status !== "Complete";

          const items =
            query.round != null
              ? yield* client.fetchRoundMatchItemsByNumber(seasonId, query.round)
              : yield* client.fetchSeasonMatchItems(seasonId, { includeUpcoming });

          return transformMatchItems(items, seasonYear(query.season), competition);
        }),
    };
  },
);

/** AFL API as a PlayerStatsSource. */
export const aflApiPlayerStatsSource: Effect.Effect<PlayerStatsSource, never, AflApi> = Effect.gen(
  function* () {
    const client = yield* AflApi;

    return {
      id: "afl-api",
      coverage: AFL_API_COVERAGE,
      fetchPlayerStats: (query) =>
        Effect.gen(function* () {
          const competition = query.competition ?? "AFLM";

          if (query.matchId) {
            const matchId = query.matchId;

            const member = yield* findSeasonMember(client, {
              competition,
              season: query.season,
              round: query.round,
              matchId,
            });

            const [rosterResult, statsResult] = yield* Effect.all(
              [
                Effect.result(client.fetchMatchRoster(matchId)),
                Effect.result(client.fetchPlayerStats(matchId)),
              ],
              { concurrency: "unbounded" },
            );

            if (Result.isFailure(statsResult)) return yield* Effect.fail(statsResult.failure);

            const teamIdMap = new Map<string, string>(AFL_API_TEAM_IDS);

            if (Result.isSuccess(rosterResult)) {
              const match = rosterResult.success.match;
              teamIdMap.set(match.homeTeamId, normaliseTeamName(match.homeTeam.name));
              teamIdMap.set(match.awayTeamId, normaliseTeamName(match.awayTeam.name));
            }

            return {
              stats: transformPlayerStats(statsResult.success, {
                matchId,
                season: seasonYear(query.season),
                roundNumber: member.round?.roundNumber ?? 0,
                competition,
                source: "afl-api",
                teamIdMap,
              }),
              failedMatchIds: [],
            };
          }

          const seasonId = yield* client.resolveCompSeason(competition, query.season);

          const matchItems: readonly MatchItem[] =
            query.round != null
              ? yield* client.fetchRoundMatchItemsByNumber(seasonId, query.round)
              : yield* client.fetchSeasonMatchItems(seasonId);

          const teamIdMap = new Map<string, string>();

          for (const item of matchItems) {
            teamIdMap.set(item.match.homeTeamId, item.match.homeTeam.name);
            teamIdMap.set(item.match.awayTeamId, item.match.awayTeam.name);
          }

          const statsResults = yield* batched(matchItems, (item) =>
            Effect.result(client.fetchPlayerStats(item.match.matchId)),
          );

          // Isolate failed matches and preserve every successful provider response.
          const allStats: PlayerStats[] = [];
          const failedMatchIds: string[] = [];

          for (const [i, statsResult] of statsResults.entries()) {
            const item = matchItems[i];

            if (!item) continue;

            if (Result.isFailure(statsResult)) {
              failedMatchIds.push(item.match.matchId);
              continue;
            }

            allStats.push(
              ...transformPlayerStats(statsResult.success, {
                matchId: item.match.matchId,
                season: seasonYear(query.season),
                roundNumber: item.round?.roundNumber ?? query.round ?? 0,
                competition,
                source: "afl-api",
                teamIdMap,
                date: parseDate(item.match.utcStartTime) ?? new Date(item.match.utcStartTime),
                homeTeam: normaliseTeamName(item.match.homeTeam.name),
                awayTeam: normaliseTeamName(item.match.awayTeam.name),
              }),
            );
          }

          return { stats: allStats, failedMatchIds };
        }),
    };
  },
);

/** AFL API as a SquadSource. */
export const aflApiSquadSource: Effect.Effect<SquadSource, never, AflApi> = Effect.gen(
  function* () {
    const client = yield* AflApi;

    /** Resolve a canonical team name to the AFL API's numeric team ID. */
    const resolveTeamId = (teamName: string, competition: CompetitionCode) =>
      Effect.gen(function* () {
        const teams = yield* client.fetchTeams(competition);
        const normalised = normaliseTeamName(teamName);
        const match = teams.find((t) => normaliseTeamName(t.name) === normalised);

        if (!match) {
          return yield* Effect.fail(
            new ValidationError({ message: `Team not found in ${competition}: ${teamName}` }),
          );
        }

        return match.id;
      });

    return {
      id: "afl-api",
      coverage: AFL_API_COVERAGE,
      fetchSquad: (query) =>
        Effect.gen(function* () {
          const competition = query.competition ?? "AFLM";
          const seasonId = yield* client.resolveCompSeason(competition, query.season);
          const teamId = yield* resolveTeamId(query.team, competition);
          const squad = yield* client.fetchSquad(teamId, seasonId);

          const teamName = normaliseTeamName(squad.squad.team?.name ?? query.team);

          const players: Player[] = squad.squad.players.map((p) => ({
            playerId: p.player.providerId ?? String(p.player.id),
            givenName: p.player.firstName,
            surname: p.player.surname,
            displayName: `${p.player.firstName} ${p.player.surname}`,
            jumperNumber: p.jumperNumber ?? null,
            position: p.position ?? null,
            dateOfBirth: p.player.dateOfBirth ?? null,
            heightCm: p.player.heightInCm || null,
            weightKg: p.player.weightInKg || null,
            draftYear: safeInt(p.player.draftYear ?? ""),
            draftPosition: safeInt(p.player.draftPosition ?? ""),
            draftType: p.player.draftType ?? null,
            debutYear: safeInt(p.player.debutYear ?? ""),
            recruitedFrom: p.player.recruitedFrom ?? null,
            // AFL API squad endpoint doesn't carry career counters
            gamesPlayed: null,
            goals: null,
            team: teamName,
            source: "afl-api",
            competition,
          }));

          return {
            teamId: String(teamId),
            teamName,
            season: seasonYear(query.season),
            scope: "season" as const,
            players,
            competition,
            source: "afl-api" as const,
          };
        }),
    };
  },
);

/** AFL API as a LineupSource. */
export const aflApiLineupSource: Effect.Effect<LineupSource, never, AflApi> = Effect.gen(
  function* () {
    const client = yield* AflApi;

    return {
      id: "afl-api",
      coverage: AFL_API_COVERAGE,
      fetchLineup: (query) =>
        Effect.gen(function* () {
          const competition = query.competition ?? "AFLM";

          if (query.matchId) {
            yield* findSeasonMember(client, {
              competition,
              season: query.season,
              round: query.round,
              matchId: query.matchId,
            });

            const roster = yield* client.fetchMatchRoster(query.matchId);

            return [
              transformMatchRoster(roster, seasonYear(query.season), query.round, competition),
            ];
          }

          const seasonId = yield* client.resolveCompSeason(competition, query.season);
          const matchItems = yield* client.fetchRoundMatchItemsByNumber(seasonId, query.round);

          if (matchItems.length === 0) {
            return yield* Effect.fail(
              new AflApiError({ message: `No matches found for round ${query.round}` }),
            );
          }

          // Every roster is fetched; the first failure in match order is reported.
          const rosterResults = yield* batched(matchItems, (item) =>
            Effect.result(client.fetchMatchRoster(item.match.matchId)),
          );

          const lineups: Lineup[] = [];

          for (const rosterResult of rosterResults) {
            if (Result.isFailure(rosterResult)) return yield* Effect.fail(rosterResult.failure);
            lineups.push(
              transformMatchRoster(
                rosterResult.success,
                seasonYear(query.season),
                query.round,
                competition,
              ),
            );
          }

          return lineups;
        }),
    };
  },
);

/** AFL API as a LadderSource. */
export const aflApiLadderSource: Effect.Effect<LadderSource, never, AflApi> = Effect.gen(
  function* () {
    const client = yield* AflApi;

    return {
      id: "afl-api",
      coverage: AFL_API_COVERAGE,
      fetchLadder: (query) =>
        Effect.gen(function* () {
          const competition = query.competition ?? "AFLM";
          const seasonId = yield* client.resolveCompSeason(competition, query.season);
          const rounds = yield* client.resolveRounds(seasonId);

          let roundId: number | undefined;

          if (query.round != null) {
            // Honour an explicit round number.
            const round = rounds.find((r) => r.roundNumber === query.round);

            if (!round) {
              return yield* Effect.fail(
                new AflApiError({
                  message: `Round ${query.round} was not found for the ${query.season} season`,
                }),
              );
            }

            roundId = round.id;
          } else {
            // No explicit round — resolve to the latest *completed* H&A round.
            // Finals don't alter the ladder (it's a Home & Away artefact only),
            // so we always anchor the default to H&A. Without this, the AFL API
            // returns a stale early-season snapshot for completed seasons (#90).
            const haRounds = rounds.filter((r) => inferRoundType(r.name) === "HomeAndAway");
            const now = Date.now();

            const completedHa = haRounds.filter((r) => {
              if (r.utcEndTime == null) return false;
              const end = new Date(r.utcEndTime).getTime();

              return Number.isFinite(end) && end <= now;
            });

            // Sort by roundNumber descending — pick the latest. If no round has
            // ended yet (very early in a season), pass through with no roundId
            // so the API returns whatever it considers current.
            const latest = completedHa.sort((a, b) => b.roundNumber - a.roundNumber)[0];

            if (latest) {
              roundId = latest.id;
            }
          }

          const ladder = yield* client.fetchLadder(seasonId, roundId);
          const firstLadder = ladder.ladders[0];
          const entries = firstLadder ? transformLadderEntries(firstLadder.entries) : [];

          return {
            season: seasonYear(query.season),
            roundNumber: ladder.round?.roundNumber ?? null,
            entries,
            competition,
            source: "afl-api" as const,
            // AFL API's ladder response doesn't include the most-recent-match id
            // on its current schema (#119); leave null. Sources that synthesise
            // the ladder from match results (afl-tables) populate it.
            asOfMatch: null,
          };
        }),
    };
  },
);
