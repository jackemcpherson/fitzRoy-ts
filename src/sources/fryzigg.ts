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
import { FRYZIGG_SNAPSHOTS } from "./fryzigg-snapshots";

/**
 * Fryzigg only publishes AFLM and AFLW datasets. VFL/VFLW are not available
 * from this source — the public API will return an UnsupportedSourceError
 * for those competitions in the source-adapter refactor (Phase B).
 *
 * Security note (SEC-10): fryziggafl.net does not serve HTTPS (verified
 * 2026-06-10 — TLS connections are refused), so these downloads are
 * plain HTTP and an on-path attacker could substitute content. The default
 * client pins operator-reviewed, trust-on-first-use snapshot digests and
 * rejects substituted bytes before invoking the RDS parser.
 */
const USER_AGENT = "fitzRoy-ts/1.0 (https://github.com/jackemcpherson/fitzRoy-ts)";

/** Options for constructing a Fryzigg client. */
export interface FryziggClientOptions extends SourceFetchOptions {
  readonly fetchFn?: typeof fetch | undefined;
  /**
   * Override the manifest's hex-encoded SHA-256 checksum. This supports
   * explicitly trusted mirrors and test fixtures. Pass `null` only when the
   * caller deliberately accepts unchecked custom bytes; default downloads
   * always use the reviewed manifest checksum.
   */
  readonly sha256?: string | null | undefined;
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
  private readonly sha256: string | null | undefined;

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
    const snapshot = FRYZIGG_SNAPSHOTS[competition as keyof typeof FRYZIGG_SNAPSHOTS];
    if (!snapshot) {
      return err(new ScrapeError(`Fryzigg does not publish ${competition} data`, "fryzigg"));
    }
    const expectedSha256 = this.sha256 === undefined ? snapshot.sha256 : this.sha256;

    try {
      const response = await this.fetchFn(snapshot.url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!response.ok) {
        return err(
          new ScrapeError(
            `Fryzigg request failed: ${response.status} (${snapshot.url})`,
            "fryzigg",
          ),
        );
      }

      const buffer = new Uint8Array(await response.arrayBuffer());

      if (expectedSha256 !== null) {
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        const actual = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (actual !== expectedSha256.toLowerCase()) {
          return err(
            new ScrapeError(`Fryzigg checksum mismatch for ${competition} snapshot`, "fryzigg"),
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
