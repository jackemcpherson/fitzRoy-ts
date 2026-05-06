/**
 * Public API for fetching player statistics across data sources.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Result } from "../lib/result";
import { dispatch, playerStatsRegistry } from "../sources/adapters/index";
import type { PlayerStats, PlayerStatsQuery } from "../types";

/**
 * Fetch per-player match statistics.
 *
 * @example
 * ```ts
 * await fetchPlayerStats({
 *   source: "afl-api", season: 2025, round: 1, competition: "AFLM"
 * });
 * ```
 */
export async function fetchPlayerStats(
  query: PlayerStatsQuery,
): Promise<Result<PlayerStats[], Error>> {
  const adapterR = dispatch(playerStatsRegistry, "player stats", query);
  return Result.flatMapAsync(adapterR, (a) => a.fetchPlayerStats(query));
}
