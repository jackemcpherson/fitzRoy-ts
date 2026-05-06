/**
 * Public API for fetching match lineup/roster data.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Result } from "../lib/result";
import { dispatch, lineupRegistry } from "../sources/adapters/index";
import type { Lineup, LineupQuery } from "../types";

/**
 * Fetch match lineup data for a round or specific match.
 *
 * When `matchId` is provided, returns a single-element array for that match.
 * When omitted, returns lineups for all matches in the round.
 */
export async function fetchLineup(query: LineupQuery): Promise<Result<Lineup[], Error>> {
  const adapterR = dispatch(lineupRegistry, "lineup", query);
  return Result.flatMapAsync(adapterR, (a) => a.fetchLineup(query));
}
