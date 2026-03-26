/**
 * Public API for fetching team-level aggregate statistics.
 *
 * Supports FootyWire and AFL Tables sources. Not available from the AFL API.
 */

import { UnsupportedSourceError } from "../lib/errors";
import { err, type Result } from "../lib/result";
import { AflTablesClient } from "../sources/afl-tables";
import { FootyWireClient } from "../sources/footywire";
import type { TeamStatsEntry, TeamStatsQuery } from "../types";

/**
 * Fetch team-level aggregate statistics for a season.
 *
 * Returns per-team stat totals or averages from FootyWire or AFL Tables.
 * Not available from the AFL API or Squiggle.
 *
 * @param query - Source, season, and optional summary type.
 * @returns Array of team stats entries.
 *
 * @example
 * ```ts
 * const result = await fetchTeamStats({ source: "footywire", season: 2024 });
 * if (result.success) {
 *   for (const entry of result.data) {
 *     console.log(entry.team, entry.stats);
 *   }
 * }
 * ```
 */
export async function fetchTeamStats(
  query: TeamStatsQuery,
): Promise<Result<TeamStatsEntry[], Error>> {
  const summaryType = query.summaryType ?? "totals";

  switch (query.source) {
    case "footywire": {
      const client = new FootyWireClient();
      return client.fetchTeamStats(query.season, summaryType);
    }

    case "afl-tables": {
      const client = new AflTablesClient();
      return client.fetchTeamStats(query.season);
    }

    case "afl-api":
    case "squiggle":
      return err(
        new UnsupportedSourceError(
          `Team stats are not available from ${query.source}. Use "footywire" or "afl-tables".`,
          query.source,
        ),
      );

    default:
      return err(new UnsupportedSourceError(`Unsupported source: ${query.source}`, query.source));
  }
}
