/**
 * Public API for fetching team-level aggregate statistics.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 *
 * Note: AFL API has no team-stats endpoint, so the senior fallback (and
 * the suggestion target) is `afl-tables` (see `defaultSourceByCapability`).
 */

import { err, type Result } from "../lib/result";
import {
  allTeamStatsSources,
  checkCoverage,
  findAlternativeSource,
  getTeamStatsSource,
  listTeamStatsSources,
  unsupportedSourceForOperation,
} from "../sources/adapters/index";
import type { TeamStatsEntry, TeamStatsQuery } from "../types";

/**
 * Fetch team-level aggregate statistics for a season.
 *
 * @example
 * ```ts
 * const result = await fetchTeamStats({ source: "footywire", season: 2024 });
 * ```
 */
export async function fetchTeamStats(
  query: TeamStatsQuery,
): Promise<Result<TeamStatsEntry[], Error>> {
  const adapter = getTeamStatsSource(query.source);
  if (!adapter) {
    return err(unsupportedSourceForOperation(query.source, "team stats", listTeamStatsSources()));
  }

  // TeamStats has no per-call competition (the query type doesn't carry one),
  // so coverage is checked against AFLM by convention — every TeamStats source
  // we support is AFLM-only.
  const alternative = findAlternativeSource(allTeamStatsSources(), {
    source: query.source,
    competition: "AFLM",
    season: query.season,
  });
  const suggestion = alternative ? `--source ${alternative}` : undefined;
  const coverage = checkCoverage(
    adapter.coverage,
    { source: query.source, operation: "team stats", competition: "AFLM", season: query.season },
    suggestion,
  );
  if (!coverage.success) return coverage;

  return adapter.fetchTeamStats(query);
}
