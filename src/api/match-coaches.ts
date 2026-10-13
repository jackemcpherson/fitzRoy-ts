/** Public API for credited coach assignments by match. */

import { Effect } from "effect";
import type { SourceError } from "../lib/errors";
import { dispatch, SourceRegistry } from "../sources/adapters/index";
import type { MatchCoachesQuery, MatchCoachesResult } from "../types";

/**
 * Fetch source-grounded credited coaches for every match in a season.
 * AFL Tables is the default provider. FootyWire season requests remain
 * unsupported pending captured match-heading evidence. Incomplete page coverage is reported in the successful result.
 *
 * @param query - Season, optional team, competition, and provider selection.
 * @returns Assignments with completeness metadata, or an expected error.
 * @example
 * ```ts
 * const result = await fetchMatchCoaches({ season: 2022, team: "Carlton" });
 * ```
 */
export function fetchMatchCoaches(
  query: MatchCoachesQuery,
): Effect.Effect<MatchCoachesResult, SourceError, SourceRegistry> {
  return Effect.gen(function* () {
    const resolved = { ...query, source: query.source ?? "afl-tables" };
    const registry = yield* SourceRegistry;
    const adapter = yield* dispatch(registry.matchCoaches, "match coach", resolved);

    return yield* adapter.fetchMatchCoaches(resolved);
  });
}
