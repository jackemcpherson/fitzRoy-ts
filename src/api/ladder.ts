/**
 * Public API for fetching ladder/standings data.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Effect } from "effect";
import type { SourceError } from "../lib/errors";
import { dispatch, SourceRegistry } from "../sources/adapters/index";
import type { Ladder, LadderQuery } from "../types";

/**
 * Fetch ladder standings for a season (optionally for a specific round).
 *
 * @example
 * ```ts
 * const result = await fetchLadder({ source: "afl-api", season: 2024, round: 10 });
 * ```
 */
export function fetchLadder(
  query: LadderQuery,
): Effect.Effect<Ladder, SourceError, SourceRegistry> {
  return Effect.gen(function* () {
    const registry = yield* SourceRegistry;
    const adapter = yield* dispatch(registry.ladder, "ladder", query);
    const ladder = yield* adapter.fetchLadder(query);

    return { ...ladder, seasonKey: String(query.season) };
  });
}
