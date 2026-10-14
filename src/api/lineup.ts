/**
 * Public API for fetching match lineup/roster data.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { Effect } from "effect";
import type { SourceError } from "../lib/errors";
import { dispatch, SourceRegistry } from "../sources/adapters/index";
import type { Lineup, LineupQuery } from "../types";

/**
 * Fetch match lineup data for a round or specific match.
 *
 * When `matchId` is provided, returns a single-element array for that match.
 * When omitted, returns lineups for all matches in the round.
 */
export function fetchLineup(
  query: LineupQuery,
): Effect.Effect<Lineup[], SourceError, SourceRegistry> {
  return Effect.gen(function* () {
    const registry = yield* SourceRegistry;
    const adapter = yield* dispatch(registry.lineup, "lineup", query);
    const rows = yield* adapter.fetchLineup(query);

    return rows.map((row) => ({ ...row, seasonKey: String(query.season) }));
  });
}
