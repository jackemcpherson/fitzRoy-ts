/**
 * Public API for fetching matches across data sources.
 *
 * Subsumes the old `fetchMatchResults` and `fetchFixture`. Use the `status`
 * filter to scope to upcoming or completed matches; omit it to get all.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Effect } from "effect";
import type { SourceError } from "../lib/errors";
import { dispatch, SourceRegistry } from "../sources/adapters/index";
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
export function fetchMatches(
  query: MatchQuery,
): Effect.Effect<Match[], SourceError, SourceRegistry> {
  return Effect.gen(function* () {
    const registry = yield* SourceRegistry;
    const adapter = yield* dispatch(registry.match, "match", query);
    const matches = yield* adapter.fetchMatches(query);

    return filterMatches(matches, query).map((match) => ({
      ...match,
      seasonKey: String(query.season),
    }));
  });
}
