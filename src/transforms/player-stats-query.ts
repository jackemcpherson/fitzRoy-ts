/** Pure query filters for the player-stat partial-result envelope. */

import type { SeasonPlayerStats } from "../types";

/**
 * Narrow successful rows and failure metadata to one exact match identifier.
 *
 * Adapters can fetch a wider scope than requested. Applying this filter after
 * every adapter keeps the public contract consistent without merging their
 * source-specific request loops.
 */
export function filterSeasonPlayerStats(
  result: SeasonPlayerStats,
  matchId: string | undefined,
): SeasonPlayerStats {
  if (matchId === undefined) return result;
  return {
    stats: result.stats.filter((entry) => entry.matchId === matchId),
    failedMatchIds: result.failedMatchIds.filter((failedMatchId) => failedMatchId === matchId),
  };
}
