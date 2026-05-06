/**
 * Public API for fetching ladder/standings data.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { err, type Result } from "../lib/result";
import {
  checkCoverage,
  defaultSourceByCapability,
  getLadderSource,
  listLadderSources,
  unsupportedSourceForOperation,
} from "../sources/adapters/index";
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
  const adapter = getLadderSource(query.source);
  if (!adapter) {
    return err(unsupportedSourceForOperation(query.source, "ladder", listLadderSources()));
  }

  const competition = query.competition ?? "AFLM";
  const suggestion =
    query.source === defaultSourceByCapability.ladder
      ? undefined
      : `--source ${defaultSourceByCapability.ladder}`;
  const coverage = checkCoverage(
    adapter.coverage,
    { source: query.source, operation: "ladder", competition, season: query.season },
    suggestion,
  );
  if (!coverage.success) return coverage;

  return adapter.fetchLadder(query);
}
