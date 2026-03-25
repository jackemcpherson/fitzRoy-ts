/**
 * Fryzigg client stub.
 *
 * The Fryzigg advanced stats data (fryziggafl.net) is only available in
 * R-specific RDS binary format, not as JSON or CSV endpoints. This makes
 * it impossible to consume from a TypeScript library.
 *
 * This module exports a stub that returns an error Result explaining the
 * limitation. If JSON/CSV endpoints are discovered in the future, this
 * module can be replaced with a real implementation.
 *
 * @see https://github.com/jimmyday12/fitzRoy — R package that uses RDS files
 */

import { ScrapeError } from "../lib/errors";
import { err, type Result } from "../lib/result";
import type { PlayerStats } from "../types";

/**
 * Attempt to fetch advanced player statistics from Fryzigg.
 *
 * @returns Always returns an error Result explaining that Fryzigg is
 * not supported in the TypeScript port.
 */
export function fetchFryziggStats(): Result<PlayerStats[], ScrapeError> {
  return err(
    new ScrapeError(
      "Fryzigg data is only available in R-specific RDS binary format and cannot be consumed from TypeScript. Use the AFL API source for player statistics instead.",
      "fryzigg",
    ),
  );
}
