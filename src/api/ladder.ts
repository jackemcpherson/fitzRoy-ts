/**
 * Public API for fetching ladder/standings data.
 *
 * Note: The AFL API does not expose a direct ladder endpoint.
 * Ladder standings must be computed from match results.
 * This is a placeholder that returns an unsupported error.
 */

import { UnsupportedSourceError } from "../lib/errors";
import { err, type Result } from "../lib/result";
import type { Ladder, LadderQuery } from "../types";

/**
 * Fetch ladder standings for a season.
 *
 * @param _query - Source, season, optional round, and competition.
 * @returns Ladder standings.
 */
export async function fetchLadder(_query: LadderQuery): Promise<Result<Ladder, Error>> {
  return err(
    new UnsupportedSourceError(
      "Ladder data is not yet supported. The AFL API does not expose a direct ladder endpoint.",
      _query.source,
    ),
  );
}
