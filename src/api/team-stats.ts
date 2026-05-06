/**
 * Public API for fetching team-level aggregate statistics.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 *
 * Note: AFL API has no team-stats endpoint, so the senior fallback (and
 * the suggestion target) is `afl-tables` (see `teamStatsRegistry.defaultSource`).
 */

import { Result } from "../lib/result";
import { dispatch, teamStatsRegistry } from "../sources/adapters/index";
import type { TeamStatsEntry, TeamStatsQuery } from "../types";

/**
 * Fetch team-level aggregate statistics for a season.
 *
 * TeamStatsQuery has no per-call competition (every TeamStats source we
 * support is AFLM-only), so dispatch checks coverage against AFLM by
 * convention.
 *
 * @example
 * ```ts
 * const result = await fetchTeamStats({ source: "footywire", season: 2024 });
 * ```
 */
export async function fetchTeamStats(
  query: TeamStatsQuery,
): Promise<Result<TeamStatsEntry[], Error>> {
  const adapterR = dispatch(teamStatsRegistry, "team stats", { ...query, competition: "AFLM" });
  return Result.flatMapAsync(adapterR, (a) => a.fetchTeamStats(query));
}
