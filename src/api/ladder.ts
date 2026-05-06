/**
 * Public API for fetching ladder/standings data.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Result } from "../lib/result";
import { dispatch, ladderRegistry } from "../sources/adapters/index";
import type { Ladder, LadderQuery } from "../types";

/**
 * Fetch ladder standings for a season (optionally for a specific round).
 *
 * @example
 * ```ts
 * const result = await fetchLadder({ source: "afl-api", season: 2024, round: 10 });
 * ```
 */
export async function fetchLadder(query: LadderQuery): Promise<Result<Ladder, Error>> {
  const adapterR = dispatch(ladderRegistry, "ladder", query);
  return Result.flatMapAsync(adapterR, (a) => a.fetchLadder(query));
}
