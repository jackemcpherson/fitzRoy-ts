/**
 * Public API for fetching player statistics across data sources.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Result } from "../lib/result";
import { dispatch, playerStatsRegistry } from "../sources/adapters/index";
import { filterSeasonPlayerStats } from "../transforms/player-stats-query";
import type { PlayerStatsQuery, SeasonPlayerStats } from "../types";

/**
 * Fetch per-player match statistics.
 *
 * Returns a {@link SeasonPlayerStats} partial-result envelope. Season
 * scrapes (afl-tables, footywire) fetch one page per game; games that
 * fail are listed in `failedMatchIds` instead of silently vanishing,
 * while the rest of the season still comes back in `stats`. Sources
 * without per-game fetches and single-match (`matchId`) queries always
 * return an empty `failedMatchIds`.
 *
 * @example
 * ```ts
 * const result = await fetchPlayerStats({
 *   source: "afl-api", season: 2025, round: 1, competition: "AFLM"
 * });
 * if (result.success) {
 *   console.log(result.data.stats.length, "stat lines");
 *   if (result.data.failedMatchIds.length > 0) {
 *     console.warn("missing games:", result.data.failedMatchIds);
 *   }
 * }
 * ```
 */
export async function fetchPlayerStats(
  query: PlayerStatsQuery,
): Promise<Result<SeasonPlayerStats, Error>> {
  const adapterR = dispatch(playerStatsRegistry, "player stats", query);
  const fetched = await Result.flatMapAsync(adapterR, (a) => a.fetchPlayerStats(query));
  return Result.map(fetched, (result) => filterSeasonPlayerStats(result, query.matchId));
}
