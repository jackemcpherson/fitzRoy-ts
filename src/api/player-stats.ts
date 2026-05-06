/**
 * Public API for fetching player statistics across data sources.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { err, type Result } from "../lib/result";
import {
  allPlayerStatsSources,
  checkCoverage,
  findAlternativeSource,
  getPlayerStatsSource,
  listPlayerStatsSources,
  unsupportedSourceForOperation,
} from "../sources/adapters/index";
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
  const adapter = getPlayerStatsSource(query.source);
  if (!adapter) {
    return err(
      unsupportedSourceForOperation(query.source, "player stats", listPlayerStatsSources()),
    );
  }

  const competition = query.competition ?? "AFLM";
  const alternative = findAlternativeSource(allPlayerStatsSources(), {
    source: query.source,
    competition,
    season: query.season,
  });
  const suggestion = alternative ? `--source ${alternative}` : undefined;
  const coverage = checkCoverage(
    adapter.coverage,
    { source: query.source, operation: "player stats", competition, season: query.season },
    suggestion,
  );
  if (!coverage.success) return coverage;

  return adapter.fetchPlayerStats(query);
}
