/**
 * Squiggle API client for AFL match data and standings.
 *
 * Squiggle provides a free JSON API at api.squiggle.com.au.
 * Requires a descriptive User-Agent header.
 *
 * @see https://api.squiggle.com.au/
 */

import { Context, Effect, Layer } from "effect";
import { decodeJson } from "../lib/decode";
import { ScrapeError } from "../lib/errors";
import { readJson, SourceHttp } from "../lib/http";
import {
  type SquiggleGamesResponse,
  SquiggleGamesResponseSchema,
  type SquiggleStandingsResponse,
  SquiggleStandingsResponseSchema,
} from "../lib/squiggle-validation";

const decodeGames = decodeJson(SquiggleGamesResponseSchema);

const decodeStandings = decodeJson(SquiggleStandingsResponseSchema);

const SQUIGGLE_BASE = "https://api.squiggle.com.au/";

const USER_AGENT = "fitzRoy-ts/1.0 (https://github.com/jackemcpherson/fitzRoy-ts)";

/**
 * Squiggle API client.
 *
 * Wraps the Squiggle JSON API with typed responses validated via Effect Schema.
 */
export class Squiggle extends Context.Service<
  Squiggle,
  {
    /**
     * Fetch games (match results or fixture) from the Squiggle API.
     *
     * @param year - Season year.
     * @param round - Optional round number.
     * @param complete - Optional completion filter (100 = complete, omit for all).
     */
    readonly fetchGames: (
      year: number,
      round?: number,
      complete?: number,
    ) => Effect.Effect<SquiggleGamesResponse, ScrapeError>;
    /**
     * Fetch standings (ladder) from the Squiggle API.
     *
     * @param year - Season year.
     * @param round - Optional round number.
     */
    readonly fetchStandings: (
      year: number,
      round?: number,
    ) => Effect.Effect<SquiggleStandingsResponse, ScrapeError>;
  }
>()("fitzroy/Squiggle") {}

/** The live Squiggle client over {@link SourceHttp}. */
export const SquiggleLive = Layer.effect(
  Squiggle,
  Effect.gen(function* () {
    const http = yield* SourceHttp;

    const fetchJson = (params: URLSearchParams) => {
      const url = `${SQUIGGLE_BASE}?${params.toString()}`;

      const requestFailed = (message: string) =>
        new ScrapeError({ message: `Squiggle request failed: ${message}`, source: "squiggle" });

      return Effect.gen(function* () {
        const response = yield* http.request(url, { headers: { "User-Agent": USER_AGENT } });

        if (!response.ok) {
          return yield* Effect.fail(requestFailed(`${response.status} (${url})`));
        }

        return yield* readJson(response);
      }).pipe(
        Effect.catchTag("RequestError", (error) => Effect.fail(requestFailed(error.message))),
      );
    };

    const invalid = (kind: string) => (message: string) =>
      new ScrapeError({
        message: `Invalid Squiggle ${kind} response: ${message}`,
        source: "squiggle",
      });

    return {
      fetchGames: (year, round, complete) => {
        const params = new URLSearchParams({ q: "games", year: String(year) });

        if (round != null) params.set("round", String(round));

        if (complete != null) params.set("complete", String(complete));

        return fetchJson(params).pipe(
          Effect.flatMap((json) => decodeGames(json).pipe(Effect.mapError(invalid("games")))),
        );
      },
      fetchStandings: (year, round) => {
        const params = new URLSearchParams({ q: "standings", year: String(year) });

        if (round != null) params.set("round", String(round));

        return fetchJson(params).pipe(
          Effect.flatMap((json) =>
            decodeStandings(json).pipe(Effect.mapError(invalid("standings"))),
          ),
        );
      },
    };
  }),
);
