/**
 * Custom error classes for fitzRoy-ts.
 *
 * Each error class represents a distinct failure domain:
 * - {@link AflApiError} — failures when communicating with the AFL API
 * - {@link ScrapeError} — failures when scraping HTML sources (FootyWire, AFL Tables)
 * - {@link ValidationError} — failures when validating data against Zod schemas
 * - {@link UnsupportedSourceError} — when a data source doesn't support the requested operation
 */

/** Error from the AFL official API (auth failures, bad responses, timeouts). */
export class AflApiError extends Error {
  override readonly name = "AflApiError";

  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
  }
}

/** Error when scraping HTML data sources. */
export class ScrapeError extends Error {
  override readonly name = "ScrapeError";

  constructor(
    message: string,
    readonly source?: string,
  ) {
    super(message);
  }
}

/** Error when a data source does not support the requested operation. */
export class UnsupportedSourceError extends Error {
  override readonly name = "UnsupportedSourceError";

  constructor(
    message: string,
    readonly source?: string,
  ) {
    super(message);
  }
}

/** Error when data fails Zod schema validation. */
export class ValidationError extends Error {
  override readonly name = "ValidationError";

  constructor(
    message: string,
    readonly issues?: ReadonlyArray<{ path: string; message: string }>,
  ) {
    super(message);
  }
}
