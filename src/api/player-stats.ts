/**
 * Public API for fetching player statistics across data sources.
 */

import { batchedMap } from "../lib/concurrency";
import { AflApiError, aflwUnsupportedError, UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { AFL_API_TEAM_IDS, normaliseTeamName } from "../lib/team-mapping";
import { AflApiClient } from "../sources/afl-api";
import { AflTablesClient } from "../sources/afl-tables";
import { FootyWireClient } from "../sources/footywire";
import { FryziggClient } from "../sources/fryzigg";
import { transformFryziggPlayerStats } from "../transforms/fryzigg-player-stats";
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

      const seasonResult = await client.resolveCompSeason(competition, query.season);
      if (!seasonResult.success) return seasonResult;

      const matchItemsResult =
        query.round != null
          ? await client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round)
          : await client.fetchSeasonMatchItems(seasonResult.data);
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
          ...transformPlayerStats(statsResult.data, {
            matchId: item.match.matchId,
            season: query.season,
            roundNumber: item.round?.roundNumber ?? query.round ?? 0,
            competition,
            source: "afl-api",
            teamIdMap,
            date: new Date(item.match.utcStartTime),
            homeTeam: normaliseTeamName(item.match.homeTeam.name),
            awayTeam: normaliseTeamName(item.match.awayTeam.name),
          }),
        );
      }

      return ok(allStats);
    }

    case "footywire": {
      if (competition === "AFLW") return err(aflwUnsupportedError("footywire"));
      const fwClient = new FootyWireClient();

      const idsResult = await fwClient.fetchSeasonMatchIds(query.season);
      if (!idsResult.success) return idsResult;

      // Pre-filter by round before scraping individual match pages
      const entries =
        query.round != null
          ? idsResult.data.filter((e) => e.roundNumber === query.round)
          : idsResult.data;

      if (entries.length === 0) {
        return ok([]);
      }

      // Scrape stats in batches of 5 with delays to be respectful
      const allStats: PlayerStats[] = [];
      const batchSize = 5;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((e) => fwClient.fetchMatchPlayerStats(e.matchId, query.season, e.roundNumber)),
        );

        for (const result of results) {
          if (result.success) {
            allStats.push(...result.data);
          }
        }

        if (i + batchSize < entries.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
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

    case "fryzigg": {
      const fzClient = new FryziggClient();
      const fzResult = await fzClient.fetchPlayerStats(competition);
      if (!fzResult.success) return fzResult;

      return transformFryziggPlayerStats(fzResult.data, {
        competition,
        season: query.season,
        round: query.round,
      });
    }

    default:
      return err(new UnsupportedSourceError(`Unsupported source: ${query.source}`, query.source));
  }
}
