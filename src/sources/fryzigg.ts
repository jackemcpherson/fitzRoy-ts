/**
 * Fryzigg RDS client for AFL player statistics.
 *
 * Fryzigg distributes advanced player statistics as static RDS (R Data
 * Serialization) files. There is no query API — the entire dataset must
 * be downloaded and parsed, then filtered client-side.
 *
 * - AFLM: ~685K rows × 80 columns (~11.6 MB compressed)
 * - AFLW: ~9.6K rows × 58 columns
 *
 * @see https://www.fryziggafl.net/
 */

import { type DataFrame, isDataFrame, parseRds, RdsError } from "@jackemcpherson/rds-js";

import { ScrapeError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { createSourceFetch, type SourceFetchOptions } from "../lib/source-fetch";
import type { CompetitionCode } from "../types";

/**
 * Fryzigg only publishes AFLM and AFLW datasets. VFL/VFLW are not available
 * from this source — the public API will return an UnsupportedSourceError
 * for those competitions in the source-adapter refactor (Phase B).
 *
 * Security note (SEC-10): fryziggafl.net does not serve HTTPS (verified
 * 2026-06-10 — TLS connections are refused), so these downloads are
 * plain HTTP and an on-path attacker could substitute content fed into
 * the RDS parser. Mitigations: rds-js validates input defensively, and
 * callers who mirror a known-good dataset can pin it via the
 * `sha256` client option below.
 */
const FRYZIGG_URLS: Partial<Record<CompetitionCode, string>> = {
  AFLM: "http://www.fryziggafl.net/static/fryziggafl.rds",
  AFLW: "http://www.fryziggafl.net/static/aflw_player_stats.rds",
};

const USER_AGENT = "fitzRoy-ts/1.0 (https://github.com/jackemcpherson/fitzRoy-ts)";

/** Options for constructing a Fryzigg client. */
export interface FryziggClientOptions extends SourceFetchOptions {
  readonly fetchFn?: typeof fetch | undefined;
  /**
   * Optional hex-encoded SHA-256 checksum of the expected RDS payload.
   * When set, a downloaded file that doesn't match is rejected — the
   * only integrity control available while the host is HTTP-only.
   */
  readonly sha256?: string | undefined;
}

/**
 * Fryzigg RDS client.
 *
 * Downloads and parses static RDS files from fryziggafl.net. The full
 * dataset is always fetched — there is no server-side filtering. Callers
 * should filter the returned DataFrame by season/round before constructing
 * row objects to minimise memory usage.
 */
export class FryziggClient {
  private readonly fetchFn: typeof fetch;
  private readonly sha256: string | undefined;

  constructor(options?: FryziggClientOptions) {
    this.fetchFn = createSourceFetch(options);
    this.sha256 = options?.sha256;
  }

  /**
   * Fetch the full player statistics dataset for a competition.
   *
   * Returns column-major DataFrame from rds-js. The caller is responsible
   * for filtering rows and mapping to domain types.
   *
   * @param competition - AFLM or AFLW.
   * @returns Column-major DataFrame with all rows, or an error.
   */
  async fetchPlayerStats(competition: CompetitionCode): Promise<Result<DataFrame, ScrapeError>> {
    const url = FRYZIGG_URLS[competition];
    if (!url) {
      return err(new ScrapeError(`Fryzigg does not publish ${competition} data`, "fryzigg"));
    }

    try {
      const response = await this.fetchFn(url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!response.ok) {
        return err(
          new ScrapeError(`Fryzigg request failed: ${response.status} (${url})`, "fryzigg"),
        );
      }

      const buffer = new Uint8Array(await response.arrayBuffer());

      if (this.sha256 !== undefined) {
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        const actual = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (actual !== this.sha256.toLowerCase()) {
          return err(
            new ScrapeError(
              `Fryzigg checksum mismatch: expected ${this.sha256}, got ${actual}`,
              "fryzigg",
            ),
          );
        }
      }

      const result = await parseRds(buffer);

      if (!isDataFrame(result)) {
        return err(new ScrapeError("Fryzigg RDS file did not contain a data frame", "fryzigg"));
      }

      return ok(result);
    } catch (cause) {
      if (cause instanceof RdsError) {
        return err(new ScrapeError(`Fryzigg RDS parse error: ${cause.message}`, "fryzigg"));
      }
      return err(
        new ScrapeError(
          `Fryzigg request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "fryzigg",
        ),
      );
    }
  }
}
