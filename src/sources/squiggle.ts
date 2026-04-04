/**
 * Squiggle API client for AFL match data and standings.
 *
 * Squiggle provides a free JSON API at api.squiggle.com.au.
 * Requires a descriptive User-Agent header.
 *
 * @see https://api.squiggle.com.au/
 */

import { ScrapeError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import {
  type SquiggleGamesResponse,
  SquiggleGamesResponseSchema,
  type SquiggleStandingsResponse,
  SquiggleStandingsResponseSchema,
} from "../lib/squiggle-validation";

const SQUIGGLE_BASE = "https://api.squiggle.com.au/";
const USER_AGENT = "fitzRoy-ts/1.0 (https://github.com/jackemcpherson/fitzRoy-ts)";

/** Options for constructing a Squiggle client. */
export interface SquiggleClientOptions {
  readonly fetchFn?: typeof fetch | undefined;
}

/**
 * Squiggle API client.
 *
 * Wraps the Squiggle JSON API with typed responses validated via Zod.
 */
export class SquiggleClient {
  private readonly fetchFn: typeof fetch;

  constructor(options?: SquiggleClientOptions) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Fetch JSON from the Squiggle API.
   */
  private async fetchJson(params: URLSearchParams): Promise<Result<unknown, ScrapeError>> {
    const url = `${SQUIGGLE_BASE}?${params.toString()}`;
    try {
      const response = await this.fetchFn(url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!response.ok) {
        return err(
          new ScrapeError(`Squiggle request failed: ${response.status} (${url})`, "squiggle"),
        );
      }

      const json: unknown = await response.json();
      return ok(json);
    } catch (cause) {
      return err(
        new ScrapeError(
          `Squiggle request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "squiggle",
        ),
      );
    }
  }

  /**
   * Fetch games (match results or fixture) from the Squiggle API.
   *
   * @param year - Season year.
   * @param round - Optional round number.
   * @param complete - Optional completion filter (100 = complete, omit for all).
   */
  async fetchGames(
    year: number,
    round?: number,
    complete?: number,
  ): Promise<Result<SquiggleGamesResponse, ScrapeError>> {
    const params = new URLSearchParams({ q: "games", year: String(year) });
    if (round != null) params.set("round", String(round));
    if (complete != null) params.set("complete", String(complete));

    const result = await this.fetchJson(params);
    if (!result.success) return result;

    const parsed = SquiggleGamesResponseSchema.safeParse(result.data);
    if (!parsed.success) {
      return err(
        new ScrapeError(`Invalid Squiggle games response: ${parsed.error.message}`, "squiggle"),
      );
    }

    return ok(parsed.data);
  }

  /**
   * Fetch standings (ladder) from the Squiggle API.
   *
   * @param year - Season year.
   * @param round - Optional round number.
   */
  async fetchStandings(
    year: number,
    round?: number,
  ): Promise<Result<SquiggleStandingsResponse, ScrapeError>> {
    const params = new URLSearchParams({ q: "standings", year: String(year) });
    if (round != null) params.set("round", String(round));

    const result = await this.fetchJson(params);
    if (!result.success) return result;

    const parsed = SquiggleStandingsResponseSchema.safeParse(result.data);
    if (!parsed.success) {
      return err(
        new ScrapeError(`Invalid Squiggle standings response: ${parsed.error.message}`, "squiggle"),
      );
    }

    return ok(parsed.data);
  }
}
