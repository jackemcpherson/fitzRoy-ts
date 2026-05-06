/**
 * Public API for fetching match lineup/roster data.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { err, type Result } from "../lib/result";
import {
  allLineupSources,
  checkCoverage,
  findAlternativeSource,
  getLineupSource,
  listLineupSources,
  unsupportedSourceForOperation,
} from "../sources/adapters/index";
import type { Lineup, LineupQuery } from "../types";

/**
 * Fetch match lineup data for a round or specific match.
 *
 * When `matchId` is provided, returns a single-element array for that match.
 * When omitted, returns lineups for all matches in the round.
 */
export async function fetchLineup(query: LineupQuery): Promise<Result<Lineup[], Error>> {
  const adapter = getLineupSource(query.source);
  if (!adapter) {
    return err(unsupportedSourceForOperation(query.source, "lineup", listLineupSources()));
  }

  const competition = query.competition ?? "AFLM";
  const alternative = findAlternativeSource(allLineupSources(), {
    source: query.source,
    competition,
    season: query.season,
  });
  const suggestion = alternative ? `--source ${alternative}` : undefined;
  const coverage = checkCoverage(
    adapter.coverage,
    { source: query.source, operation: "lineup", competition, season: query.season },
    suggestion,
  );
  if (!coverage.success) return coverage;

  return adapter.fetchLineup(query);
}
