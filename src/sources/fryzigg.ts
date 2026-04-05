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
import type { CompetitionCode } from "../types";

const FRYZIGG_URLS: Record<CompetitionCode, string> = {
  AFLM: "http://www.fryziggafl.net/static/fryziggafl.rds",
  AFLW: "http://www.fryziggafl.net/static/aflw_player_stats.rds",
};

const USER_AGENT = "fitzRoy-ts/1.0 (https://github.com/jackemcpherson/fitzRoy-ts)";

/** Options for constructing a Fryzigg client. */
export interface FryziggClientOptions {
  readonly fetchFn?: typeof fetch | undefined;
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

  constructor(options?: FryziggClientOptions) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch.bind(globalThis);
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
