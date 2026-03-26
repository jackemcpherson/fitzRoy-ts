/**
 * Public API for fetching player statistics across data sources.
 */

import { AflApiError, UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { AflApiClient } from "../sources/afl-api";
import { transformPlayerStats } from "../transforms/player-stats";
import type { PlayerStats, PlayerStatsQuery } from "../types";

/**
 * Fetch per-player match statistics.
 *
 * @param query - Source, season, optional round/matchId, and competition.
 * @returns Array of player stats.
 *
 * @example
 * ```ts
 * const result = await fetchPlayerStats({
 *   source: "afl-api", season: 2025, round: 1, competition: "AFLM"
 * });
 * ```
 */
export async function fetchPlayerStats(
  query: PlayerStatsQuery,
): Promise<Result<PlayerStats[], Error>> {
  const competition = query.competition ?? "AFLM";

  switch (query.source) {
    case "afl-api": {
      const client = new AflApiClient();

      if (query.matchId) {
        const result = await client.fetchPlayerStats(query.matchId);
        if (!result.success) return result;
        return ok(
          transformPlayerStats(
            result.data,
            query.matchId,
            query.season,
            query.round ?? 0,
            competition,
          ),
        );
      }

      const seasonResult = await client.resolveCompSeason(competition, query.season);
      if (!seasonResult.success) return seasonResult;

      const roundNumber = query.round ?? 1;
      const matchItemsResult = await client.fetchRoundMatchItemsByNumber(
        seasonResult.data,
        roundNumber,
      );
      if (!matchItemsResult.success) return matchItemsResult;

      const teamIdMap = new Map<string, string>();
      for (const item of matchItemsResult.data) {
        teamIdMap.set(item.match.homeTeamId, item.match.homeTeam.name);
        teamIdMap.set(item.match.awayTeamId, item.match.awayTeam.name);
      }

      const statsResults = await Promise.all(
        matchItemsResult.data.map((item) => client.fetchPlayerStats(item.match.matchId)),
      );

      const allStats: PlayerStats[] = [];
      for (let i = 0; i < statsResults.length; i++) {
        const statsResult = statsResults[i];
        if (!statsResult?.success)
          return statsResult ?? err(new AflApiError("Missing stats result"));
        const item = matchItemsResult.data[i];
        if (!item) continue;
        allStats.push(
          ...transformPlayerStats(
            statsResult.data,
            item.match.matchId,
            query.season,
            roundNumber,
            competition,
            "afl-api",
            teamIdMap,
          ),
        );
      }

      return ok(allStats);
    }

    case "footywire":
      return err(
        new UnsupportedSourceError(
          "Player stats from FootyWire are not yet supported. Use source: 'afl-api'.",
          "footywire",
        ),
      );

    case "afl-tables":
      return err(
        new UnsupportedSourceError(
          "Player stats from AFL Tables are not yet supported. Use source: 'afl-api'.",
          "afl-tables",
        ),
      );

    default:
      return err(new UnsupportedSourceError(`Unsupported source: ${query.source}`, query.source));
  }
}
