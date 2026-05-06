/**
 * Coverage descriptors and the check helper that backs every per-capability
 * registry lookup.
 *
 * Each adapter declares a static `coverage` map of `CompetitionCode →
 * SeasonRange`. The public API uses {@link checkCoverage} to validate a
 * request against the chosen source's coverage *before* dispatching, so
 * out-of-range requests fail with a structured error and a suggestion
 * (per ADR-0001) rather than a confusing 404 from the source.
 */

import {
  OutOfRangeError,
  UnsupportedCompetitionError,
  UnsupportedSourceError,
} from "../../lib/errors";
import type { Result } from "../../lib/result";
import { err, ok } from "../../lib/result";
import type { CompetitionCode, DataSource } from "../../types";

/** A range of seasons that an adapter supports for a given competition. */
export interface SeasonRange {
  readonly minSeason: number;
  readonly maxSeason?: number | undefined;
}

/** Map declaring which competitions × seasons an adapter covers. */
export type CoverageMap = ReadonlyMap<CompetitionCode, SeasonRange>;

/** What the public API knows about a request before delegating to an adapter. */
export interface CoverageRequest {
  readonly source: DataSource;
  readonly operation: string;
  readonly competition: CompetitionCode;
  readonly season: number;
}

/**
 * Check whether the requested (competition, season) lies within a coverage map.
 *
 * Returns `ok(undefined)` on hit, or a structured error on miss. The optional
 * `suggestion` is folded into the error so the user can act on it.
 */
export function checkCoverage(
  coverage: CoverageMap,
  request: CoverageRequest,
  suggestion?: string,
): Result<undefined, UnsupportedCompetitionError | OutOfRangeError> {
  const range = coverage.get(request.competition);
  if (!range) {
    const tail = suggestion ? ` Try ${suggestion}.` : "";
    return err(
      new UnsupportedCompetitionError(
        `${request.source} does not provide ${request.operation} data for ${request.competition}.${tail}`,
        request.source,
        request.competition,
        suggestion,
      ),
    );
  }
  if (request.season < range.minSeason) {
    const tail = suggestion ? ` Try ${suggestion}.` : "";
    return err(
      new OutOfRangeError(
        `${request.source} only covers ${request.competition} ${request.operation} from ${range.minSeason}; you asked for ${request.season}.${tail}`,
        request.source,
        request.competition,
        request.season,
        suggestion,
      ),
    );
  }
  if (range.maxSeason != null && request.season > range.maxSeason) {
    const tail = suggestion ? ` Try ${suggestion}.` : "";
    return err(
      new OutOfRangeError(
        `${request.source} only covers ${request.competition} ${request.operation} up to ${range.maxSeason}; you asked for ${request.season}.${tail}`,
        request.source,
        request.competition,
        request.season,
        suggestion,
      ),
    );
  }
  return ok(undefined);
}

/** Convenience helper for the "wrong source ID entirely" case. */
export function unsupportedSourceForOperation(
  source: DataSource,
  operation: string,
  registered: readonly DataSource[],
): UnsupportedSourceError {
  return new UnsupportedSourceError(
    `${source} does not provide ${operation} data. Supported sources: ${registered.join(", ")}.`,
    source,
  );
}
