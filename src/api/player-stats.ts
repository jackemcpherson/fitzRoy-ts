/**
 * Public API for fetching player statistics across data sources.
 */

import { batchedMap } from "../lib/concurrency";
import { AflApiError, aflwUnsupportedError, UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { AflApiClient } from "../sources/afl-api";
import { AflTablesClient } from "../sources/afl-tables";
import { FootyWireClient } from "../sources/footywire";
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
        const [rosterResult, statsResult] = await Promise.all([
          client.fetchMatchRoster(query.matchId),
          client.fetchPlayerStats(query.matchId),
        ]);

        if (!statsResult.success) return statsResult;

        const teamIdMap = new Map<string, string>();
        if (rosterResult.success) {
          const match = rosterResult.data.match;
          teamIdMap.set(match.homeTeamId, match.homeTeam.name);
          teamIdMap.set(match.awayTeamId, match.awayTeam.name);
        }

        return ok(
          transformPlayerStats(
            statsResult.data,
            query.matchId,
            query.season,
            query.round ?? 0,
            competition,
            "afl-api",
            teamIdMap.size > 0 ? teamIdMap : undefined,
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

      const statsResults = await batchedMap(matchItemsResult.data, (item) =>
        client.fetchPlayerStats(item.match.matchId),
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

    case "footywire": {
      if (competition === "AFLW") return err(aflwUnsupportedError("footywire"));
      const fwClient = new FootyWireClient();

      // Get match IDs for the season
      const idsResult = await fwClient.fetchSeasonMatchIds(query.season);
      if (!idsResult.success) return idsResult;

      const matchIds = idsResult.data;
      if (matchIds.length === 0) {
        return ok([]);
      }

      // Scrape stats in batches of 5 to avoid rate limiting
      const allStats: PlayerStats[] = [];
      const batchSize = 5;
      for (let i = 0; i < matchIds.length; i += batchSize) {
        const batch = matchIds.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((mid) => fwClient.fetchMatchPlayerStats(mid, query.season, query.round ?? 0)),
        );

        for (const result of results) {
          if (result.success) {
            allStats.push(...result.data);
          }
        }

        // Small delay between batches to be respectful
        if (i + batchSize < matchIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Filter by round if specified
      if (query.round != null) {
        return ok(allStats.filter((s) => s.roundNumber === query.round));
      }

      return ok(allStats);
    }

    case "afl-tables": {
      if (competition === "AFLW") return err(aflwUnsupportedError("afl-tables"));
      const atClient = new AflTablesClient();
      const atResult = await atClient.fetchSeasonPlayerStats(query.season);
      if (!atResult.success) return atResult;

      if (query.round != null) {
        return ok(atResult.data.filter((s) => s.roundNumber === query.round));
      }
      return atResult;
    }

    default:
      return err(new UnsupportedSourceError(`Unsupported source: ${query.source}`, query.source));
  }
}
