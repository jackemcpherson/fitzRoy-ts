/**
 * Public API for fetching player statistics across data sources.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Effect } from "effect";
import type { SourceError } from "../lib/errors";
import { dispatch, SourceRegistry } from "../sources/adapters/index";
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
export function fetchPlayerStats(
  query: PlayerStatsQuery,
): Effect.Effect<SeasonPlayerStats, SourceError, SourceRegistry> {
  return Effect.gen(function* () {
    const registry = yield* SourceRegistry;
    const adapter = yield* dispatch(registry.playerStats, "player stats", query);
    const result = yield* adapter.fetchPlayerStats(query);

    return filterSeasonPlayerStats(
      {
        ...result,
        stats: result.stats.map((row) => ({ ...row, seasonKey: String(query.season) })),
      },
      query.matchId,
    );
  });
}
