/**
 * AFL API source adapters.
 *
 * One class per capability (Match, PlayerStats, Squad, Lineup, Ladder)
 * because each capability has its own coverage map. AFL API supports the
 * same season ranges across all of its operations, but per-capability
 * classes keep the design uniform with sources whose coverage *does* vary
 * per operation (e.g., AFL Tables: matches from 1897, stats from ~1965).
 */

import { batchedMap } from "../../lib/concurrency";
import { parseDate } from "../../lib/date-utils";
import { AflApiError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { AFL_API_TEAM_IDS, normaliseTeamName } from "../../lib/team-mapping";
import { transformMatchItems } from "../../transforms/match-results";
import { transformPlayerStats } from "../../transforms/player-stats";
import type { Match, MatchQuery, PlayerStats, PlayerStatsQuery } from "../../types";
import { AflApiClient } from "../afl-api";
import type { MatchSource, PlayerStatsSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

/** Per-capability coverage shared by every AFL API capability. */
const AFL_API_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 2012 }],
  ["AFLW", { minSeason: 2017 }],
  ["VFL", { minSeason: 2021 }],
  ["VFLW", { minSeason: 2021 }],
]);

/** AFL API as a MatchSource. */
export class AflApiMatchSource implements MatchSource {
  readonly id = "afl-api" as const;
  readonly coverage = AFL_API_COVERAGE;

  constructor(private readonly client: AflApiClient = new AflApiClient()) {}

  async fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
    const competition = query.competition ?? "AFLM";
    const seasonResult = await this.client.resolveCompSeason(competition, query.season);
    if (!seasonResult.success) return seasonResult;

    const includeUpcoming = query.status !== "Complete";
    const itemsResult =
      query.round != null
        ? await this.client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round)
        : await this.client.fetchSeasonMatchItems(seasonResult.data, { includeUpcoming });
    if (!itemsResult.success) return itemsResult;
    return ok(transformMatchItems(itemsResult.data, query.season, competition));
  }
}

/** AFL API as a PlayerStatsSource. */
export class AflApiPlayerStatsSource implements PlayerStatsSource {
  readonly id = "afl-api" as const;
  readonly coverage = AFL_API_COVERAGE;

  constructor(private readonly client: AflApiClient = new AflApiClient()) {}

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<PlayerStats[], Error>> {
    const competition = query.competition ?? "AFLM";

    if (query.matchId) {
      const [rosterResult, statsResult] = await Promise.all([
        this.client.fetchMatchRoster(query.matchId),
        this.client.fetchPlayerStats(query.matchId),
      ]);
      if (!statsResult.success) return statsResult;

      const teamIdMap = new Map<string, string>(AFL_API_TEAM_IDS);
      if (rosterResult.success) {
        const match = rosterResult.data.match;
        teamIdMap.set(match.homeTeamId, normaliseTeamName(match.homeTeam.name));
        teamIdMap.set(match.awayTeamId, normaliseTeamName(match.awayTeam.name));
      }

      return ok(
        transformPlayerStats(statsResult.data, {
          matchId: query.matchId,
          season: query.season,
          roundNumber: query.round ?? 0,
          competition,
          source: "afl-api",
          teamIdMap,
        }),
      );
    }

    const seasonResult = await this.client.resolveCompSeason(competition, query.season);
    if (!seasonResult.success) return seasonResult;

    const matchItemsResult =
      query.round != null
        ? await this.client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round)
        : await this.client.fetchSeasonMatchItems(seasonResult.data);
    if (!matchItemsResult.success) return matchItemsResult;

    const teamIdMap = new Map<string, string>();
    for (const item of matchItemsResult.data) {
      teamIdMap.set(item.match.homeTeamId, item.match.homeTeam.name);
      teamIdMap.set(item.match.awayTeamId, item.match.awayTeam.name);
    }

    const statsResults = await batchedMap(matchItemsResult.data, (item) =>
      this.client.fetchPlayerStats(item.match.matchId),
    );

    const allStats: PlayerStats[] = [];
    for (let i = 0; i < statsResults.length; i++) {
      const statsResult = statsResults[i];
      if (!statsResult?.success) {
        return statsResult ?? err(new AflApiError("Missing stats result"));
      }
      const item = matchItemsResult.data[i];
      if (!item) continue;
      allStats.push(
        ...transformPlayerStats(statsResult.data, {
          matchId: item.match.matchId,
          season: query.season,
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

    return ok(allStats);
  }
}
