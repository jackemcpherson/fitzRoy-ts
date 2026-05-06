/**
 * Capability dispatch — the single seam for ADR-0001 enforcement.
 *
 * Every public API function in `src/api/*` calls `dispatch` to translate
 * a (registry, query) pair into either an adapter ready to serve the
 * request, or a structured error suggesting an alternative `--source`.
 * No silent cross-source fallback ever happens; the suggestion is named
 * in the error and the caller decides whether to retry.
 *
 * Concentrating this logic here means ADR-0001 has one test surface and
 * one place to evolve, rather than five copies of the same dance across
 * the api/* files.
 */

import { err, ok, type Result } from "../../lib/result";
import type { CompetitionCode, DataSource } from "../../types";
import type { CapabilityAdapter } from "./capabilities";
import { checkCoverage, findAlternativeSource, unsupportedSourceForOperation } from "./coverage";
import type { CapabilityRegistry } from "./registry";

/** Common shape of every public-API query that flows through dispatch. */
export interface DispatchQuery {
  readonly source: DataSource;
  readonly competition?: CompetitionCode | undefined;
  readonly season: number;
}

/**
 * Resolve the adapter for a request, or return a structured error.
 *
 * Three outcomes:
 * 1. Source isn't registered for this capability → `UnsupportedSourceError`.
 * 2. Source is registered but doesn't cover the requested
 *    (competition, season) → `OutOfRangeError` / `UnsupportedCompetitionError`,
 *    with a `--source X` suggestion if any other registered adapter does.
 * 3. Adapter is found and coverage is satisfied → `ok(adapter)`.
 *
 * The competition default (`AFLM`) is applied here so callers don't have
 * to repeat it. `operation` is the human-readable label used in error
 * messages (e.g. `"match"`, `"player stats"`).
 */
export function dispatch<I extends CapabilityAdapter>(
  registry: CapabilityRegistry<I>,
  operation: string,
  query: DispatchQuery,
): Result<I, Error> {
  const adapter = registry.get(query.source);
  if (!adapter) {
    return err(unsupportedSourceForOperation(query.source, operation, registry.list()));
  }

  const competition = query.competition ?? "AFLM";
  const alternative = findAlternativeSource(registry.all(), {
    source: query.source,
    competition,
    season: query.season,
  });
  const suggestion = alternative ? `--source ${alternative}` : undefined;
  const coverage = checkCoverage(
    adapter.coverage,
    { source: query.source, operation, competition, season: query.season },
    suggestion,
  );
  if (!coverage.success) return coverage;

  return ok(adapter);
}
