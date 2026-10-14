/**
 * Tagged error classes for fitzRoy-ts.
 *
 * Every expected failure is a `Schema.TaggedError`: an `Error` subclass whose
 * `name` and `_tag` equal the class name, with typed, schema-validated fields.
 * Handle them with `Effect.catchTag` or `Match.tag`.
 *
 * Each error class represents a distinct failure domain:
 * - {@link AflApiError} — failures when communicating with the AFL API
 * - {@link ScrapeError} — failures when scraping HTML sources (FootyWire, AFL Tables)
 * - {@link ValidationError} — failures when validating data against Effect schemas
 * - {@link UnsupportedSourceError} — when a data source doesn't support the requested operation
 */

import { Schema } from "effect";

/** Error from the AFL official API (auth failures, bad responses, timeouts). */
export class AflApiError extends Schema.TaggedError<AflApiError>()("AflApiError", {
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
}) {}

/** Error when scraping HTML data sources. */
export class ScrapeError extends Schema.TaggedError<ScrapeError>()("ScrapeError", {
  message: Schema.String,
  source: Schema.optional(Schema.String),
  /** HTTP status when the failure was a non-OK response. */
  statusCode: Schema.optional(Schema.Number),
}) {}

/** Error when a data source does not support the requested operation. */
export class UnsupportedSourceError extends Schema.TaggedError<UnsupportedSourceError>()(
  "UnsupportedSourceError",
  {
    message: Schema.String,
    source: Schema.optional(Schema.String),
  },
) {}

/**
 * Error when a source is registered for an operation but does not cover the
 * requested competition. The optional suggestion names another source that
 * does cover it (per ADR-0001 — no silent fallback; explicit suggestion only).
 */
export class UnsupportedCompetitionError extends Schema.TaggedError<UnsupportedCompetitionError>()(
  "UnsupportedCompetitionError",
  {
    message: Schema.String,
    source: Schema.String,
    competition: Schema.String,
    suggestion: Schema.optional(Schema.String),
  },
) {}

/**
 * Error when the requested season is outside the source's coverage for the
 * given competition. The optional suggestion names another source that does
 * cover the season.
 */
export class OutOfRangeError extends Schema.TaggedError<OutOfRangeError>()("OutOfRangeError", {
  message: Schema.String,
  source: Schema.String,
  competition: Schema.String,
  season: Schema.Number,
  suggestion: Schema.optional(Schema.String),
}) {}

/** One failed check from boundary validation. */
export const ValidationIssueSchema = Schema.Struct({
  path: Schema.String,
  message: Schema.String,
});

/** Error when data fails Effect Schema validation. */
export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  message: Schema.String,
  issues: Schema.optional(Schema.Array(ValidationIssueSchema)),
}) {}

/**
 * Error returned by {@link localToUtc} when the supplied wall-clock time
 * falls inside a DST spring-forward gap (the time doesn't exist in the
 * given timezone). Callers can choose to skip, escalate, or roll forward.
 */
export class DstGapError extends Schema.TaggedError<DstGapError>()("DstGapError", {
  message: Schema.String,
  timezone: Schema.String,
  year: Schema.Number,
  monthIndex: Schema.Number,
  day: Schema.Number,
  hours: Schema.Number,
  minutes: Schema.Number,
}) {}

/** A calendar year identifies multiple competition seasons. */
export class AmbiguousSeasonError extends Schema.TaggedError<AmbiguousSeasonError>()(
  "AmbiguousSeasonError",
  {
    competition: Schema.String,
    year: Schema.Number,
    validSelectors: Schema.Array(Schema.String),
  },
) {
  override get message(): string {
    return `Ambiguous ${this.competition} season ${this.year}; choose ${this.validSelectors.join(" or ")}`;
  }
}

/** A multi-request operation produced no usable data (every part failed). */
export class IncompleteDataError extends Schema.TaggedError<IncompleteDataError>()(
  "IncompleteDataError",
  {
    message: Schema.String,
    /** The first underlying failure, when one exists. */
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/** Every expected failure a data source can report. */
export type SourceError =
  | AflApiError
  | ScrapeError
  | ValidationError
  | UnsupportedSourceError
  | UnsupportedCompetitionError
  | OutOfRangeError
  | AmbiguousSeasonError
  | IncompleteDataError;
