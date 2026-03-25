/**
 * Public API for fetching player statistics across data sources.
 */

import { AflApiError } from "../lib/errors";
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

      // If a specific match ID is provided, fetch stats for that match.
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

      // Otherwise, resolve the round and fetch stats for all matches.
      const compResult = await client.resolveCompetitionId(competition);
      if (!compResult.success) return compResult;

      const seasonResult = await client.resolveSeasonId(compResult.data, query.season);
      if (!seasonResult.success) return seasonResult;

      const roundNumber = query.round ?? 1;
      const matchItemsResult = await client.fetchRoundMatchItemsByNumber(
        seasonResult.data,
        roundNumber,
      );
      if (!matchItemsResult.success) return matchItemsResult;

      const allStats: PlayerStats[] = [];
      for (const item of matchItemsResult.data) {
        const statsResult = await client.fetchPlayerStats(item.match.matchId);
        if (!statsResult.success) return statsResult;
        allStats.push(
          ...transformPlayerStats(
            statsResult.data,
            item.match.matchId,
            query.season,
            roundNumber,
            competition,
          ),
        );
      }

      return ok(allStats);
    }

    case "footywire":
      return err(
        new AflApiError(
          "Player stats from FootyWire are not yet supported. Use source: 'afl-api'.",
        ),
      );

    case "afl-tables":
      return err(
        new AflApiError(
          "Player stats from AFL Tables are not yet supported. Use source: 'afl-api'.",
        ),
      );

    default:
      return err(new AflApiError(`Unsupported source: ${query.source}`));
  }
}
