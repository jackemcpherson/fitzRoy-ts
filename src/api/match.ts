/**
 * Public API for fetching matches across data sources.
 *
 * Subsumes the old `fetchMatchResults` and `fetchFixture`. Use the `status`
 * filter to scope to upcoming or completed matches; omit it to get all.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Result } from "../lib/result";
import { dispatch, matchRegistry } from "../sources/adapters/index";
import { filterMatches } from "../transforms/match";
import type { Match, MatchQuery } from "../types";

/**
 * Fetch matches matching the query.
 *
 * @example
 * ```ts
 * // All AFLM matches in 2025 round 3
 * await fetchMatches({ source: "afl-api", season: 2025, round: 3 });
 *
 * // Only upcoming matches (a "fixture" view)
 * await fetchMatches({ source: "afl-api", season: 2025, status: "Upcoming" });
 *
 * // One specific match by id
 * await fetchMatches({ source: "afl-api", season: 2025, matchId: "CD_M..." });
 * ```
 */
export async function fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
  const adapterR = dispatch(matchRegistry, "match", query);
  const fetchedR = await Result.flatMapAsync(adapterR, (a) => a.fetchMatches(query));
  return Result.map(fetchedR, (matches) => filterMatches(matches, query));
}
