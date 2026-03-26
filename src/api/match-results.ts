/**
 * Public API for fetching match results across data sources.
 */

import { UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { AflApiClient } from "../sources/afl-api";
import { AflTablesClient } from "../sources/afl-tables";
import { FootyWireClient } from "../sources/footywire";
import { transformMatchItems } from "../transforms/match-results";
import type { MatchResult, SeasonRoundQuery } from "../types";

/**
 * Fetch match results for a season (and optionally a specific round).
 *
 * @param query - Source, season, optional round, and competition.
 * @returns Array of match results.
 *
 * @example
 * ```ts
 * const result = await fetchMatchResults({ source: "afl-api", season: 2025, competition: "AFLM" });
 * ```
 */
export async function fetchMatchResults(
  query: SeasonRoundQuery,
): Promise<Result<MatchResult[], Error>> {
  const competition = query.competition ?? "AFLM";

  switch (query.source) {
    case "afl-api": {
      const client = new AflApiClient();

      const seasonResult = await client.resolveCompSeason(competition, query.season);
      if (!seasonResult.success) return seasonResult;

      if (query.round != null) {
        const itemsResult = await client.fetchRoundMatchItemsByNumber(
          seasonResult.data,
          query.round,
        );
        if (!itemsResult.success) return itemsResult;
        return ok(transformMatchItems(itemsResult.data, query.season, competition));
      }

      const itemsResult = await client.fetchSeasonMatchItems(seasonResult.data);
      if (!itemsResult.success) return itemsResult;
      return ok(transformMatchItems(itemsResult.data, query.season, competition));
    }

    case "footywire": {
      const client = new FootyWireClient();
      const result = await client.fetchSeasonResults(query.season);
      if (!result.success) return result;

      if (query.round != null) {
        return ok(result.data.filter((m) => m.roundNumber === query.round));
      }
      return result;
    }

    case "afl-tables": {
      const client = new AflTablesClient();
      const result = await client.fetchSeasonResults(query.season);
      if (!result.success) return result;

      if (query.round != null) {
        return ok(result.data.filter((m) => m.roundNumber === query.round));
      }
      return result;
    }

    default:
      return err(new UnsupportedSourceError(`Unsupported source: ${query.source}`, query.source));
  }
}
