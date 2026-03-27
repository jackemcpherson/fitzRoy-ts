/**
 * Public API for fetching team-level aggregate statistics.
 *
 * Supports FootyWire and AFL Tables sources. Not available from the AFL API.
 */

import { UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
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

      const statsResult = await client.fetchTeamStats(query.season);
      if (!statsResult.success) return statsResult;

      // The stats page lacks a GP column — derive from match results if needed
      const needsGp = statsResult.data.some((e) => e.gamesPlayed === 0);
      const gpMap = new Map<string, number>();
      if (needsGp) {
        const resultsResult = await client.fetchSeasonResults(query.season);
        if (resultsResult.success) {
          for (const m of resultsResult.data) {
            const home = normaliseTeamName(m.homeTeam);
            const away = normaliseTeamName(m.awayTeam);
            gpMap.set(home, (gpMap.get(home) ?? 0) + 1);
            gpMap.set(away, (gpMap.get(away) ?? 0) + 1);
          }
        }
      }

      const enriched = statsResult.data.map((entry) => ({
        ...entry,
        gamesPlayed: gpMap.get(normaliseTeamName(entry.team)) ?? entry.gamesPlayed,
      }));

      // Compute averages by dividing totals by games played
      if (summaryType === "averages") {
        return ok(
          enriched.map((entry) => ({
            ...entry,
            stats: Object.fromEntries(
              Object.entries(entry.stats).map(([k, v]) => [
                k,
                entry.gamesPlayed > 0 ? +(v / entry.gamesPlayed).toFixed(1) : 0,
              ]),
            ),
          })),
        );
      }

      return ok(enriched);
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
