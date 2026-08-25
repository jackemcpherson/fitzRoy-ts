/**
 * Public API for fetching team-level aggregate statistics.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 *
 * Note: AFL API has no team-stats endpoint, so the senior fallback (and
 * the suggestion target) is `afl-tables` (see `teamStatsRegistry.defaultSource`).
 */

import { ScrapeError } from "../lib/errors";
import { err, ok, Result } from "../lib/result";
import { dispatch, teamStatsRegistry } from "../sources/adapters/index";
import type { TeamStatsEntry, TeamStatsQuery } from "../types";

/**
 * Fetch team-level aggregate statistics for a season.
 *
 * Team-stat sources currently cover AFLM only. Dispatch validates the requested
 * competition before an adapter performs network access.
 * AFL Tables totals can contain `gamesPlayed: null` when match enrichment fails.
 * Averages fail when any denominator is missing or non-positive.
 *
 * @example
 * ```ts
 * const result = await fetchTeamStats({ source: "footywire", season: 2024 });
 * ```
 */
export async function fetchTeamStats(
  query: TeamStatsQuery,
): Promise<Result<TeamStatsEntry[], Error>> {
  const adapterR = dispatch(teamStatsRegistry, "team stats", query);
  const fetched = await Result.flatMapAsync(adapterR, (a) => a.fetchTeamStats(query));
  if (query.summaryType !== "averages") return fetched;
  return Result.flatMap(fetched, (entries) => {
    const invalid = entries.filter((entry) => entry.gamesPlayed === null || entry.gamesPlayed <= 0);
    if (invalid.length > 0) {
      return err(
        new ScrapeError(
          `Cannot return team-stat averages because games played is missing or non-positive for: ${invalid.map((entry) => entry.team).join(", ")}`,
          query.source,
        ),
      );
    }
    return ok(entries);
  });
}
