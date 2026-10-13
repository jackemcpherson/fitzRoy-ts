import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ScrapeError } from "../../src/lib/errors";
import { Squiggle, SquiggleLive } from "../../src/sources/squiggle";
import { fixtureHttp, type RequestLog, requestLog, type RouteAnswer } from "../support/http";

// Minimal valid game payload derived from test/fixtures/squiggle-games-2024-r1.json
const VALID_GAME = {
  id: 35704,
  year: 2024,
  round: 1,
  roundname: "Round 1",
  hteam: "Carlton",
  ateam: "Richmond",
  hteamid: 3,
  ateamid: 14,
  hscore: 86,
  ascore: 81,
  hgoals: 12,
  agoals: 12,
  hbehinds: 14,
  abehinds: 9,
  winner: "Carlton",
  winnerteamid: 3,
  venue: "M.C.G.",
  date: "2024-03-14 19:30:00",
  localtime: "2024-03-14 19:30:00",
  tz: "+11:00",
  unixtime: 1710405000,
  timestr: "Full Time",
  complete: 100,
  is_final: 0,
  is_grand_final: 0,
  updated: "2024-03-14 22:14:45",
};

// Minimal valid standing payload derived from test/fixtures/squiggle-standings-2024-r10.json
const VALID_STANDING = {
  id: 16,
  name: "Sydney",
  rank: 1,
  played: 10,
  wins: 9,
  losses: 1,
  draws: 0,
  pts: 36,
  for: 1030,
  against: 666,
  percentage: 154.654654654655,
  goals_for: 151,
  goals_against: 92,
  behinds_for: 124,
  behinds_against: 114,
};

/** The live Squiggle client answering every request with `answer`. */
function squiggleWith(answer: RouteAnswer, log?: RequestLog) {
  return SquiggleLive.pipe(
    Layer.provide(fixtureHttp([["api.squiggle.com.au", answer]], log ? { log } : undefined)),
  );
}

describe("Squiggle.fetchGames", () => {
  it.effect("builds the correct URL and includes fitzRoy-ts User-Agent header", () => {
    const log = requestLog();

    return Effect.gen(function* () {
      const squiggle = yield* Squiggle;

      yield* squiggle.fetchGames(2025, 3);
      expect(log.urls).toHaveLength(1);
      const url = log.urls[0] ?? "";
      expect(url).toContain("q=games");
      expect(url).toContain("year=2025");
      expect(url).toContain("round=3");
      const headers = new Headers(log.inits[0]?.headers);
      expect(headers.get("User-Agent") ?? "").toContain("fitzRoy-ts");
    }).pipe(Effect.provide(squiggleWith({ body: JSON.stringify({ games: [VALID_GAME] }) }, log)));
  });

  it.effect("returns parsed games on a valid response", () =>
    Effect.gen(function* () {
      const data = yield* Squiggle.use((squiggle) => squiggle.fetchGames(2024, 1));

      expect(data.games).toHaveLength(1);
      expect(data.games[0]?.hteam).toBe("Carlton");
    }).pipe(Effect.provide(squiggleWith({ body: JSON.stringify({ games: [VALID_GAME] }) }))),
  );

  it.effect("fails with a ScrapeError containing the status code on a non-ok response", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Squiggle.use((squiggle) => squiggle.fetchGames(2024, 1)));

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toContain("500");
    }).pipe(Effect.provide(squiggleWith({ body: "Internal Server Error", status: 500 }))),
  );

  it.effect("fails with a ScrapeError containing the cause message when fetch rejects", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Squiggle.use((squiggle) => squiggle.fetchGames(2024, 1)));

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toContain("ECONNRESET");
    }).pipe(
      Effect.provide(
        squiggleWith({
          respond: () => {
            throw new Error("ECONNRESET");
          },
        }),
      ),
    ),
  );

  it.effect("fails with a ScrapeError when the response shape fails schema validation", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Squiggle.use((squiggle) => squiggle.fetchGames(2024, 1)));

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toMatch(/^Invalid Squiggle games response/);
    }).pipe(
      // id must be a number — passing a string breaks the schema
      Effect.provide(
        squiggleWith({ body: JSON.stringify({ games: [{ ...VALID_GAME, id: "not-a-number" }] }) }),
      ),
    ),
  );
});

describe("Squiggle.fetchStandings", () => {
  it.effect("returns parsed standings on a valid response", () =>
    Effect.gen(function* () {
      const data = yield* Squiggle.use((squiggle) => squiggle.fetchStandings(2024));

      expect(data.standings).toHaveLength(1);
      expect(data.standings[0]?.name).toBe("Sydney");
    }).pipe(
      Effect.provide(squiggleWith({ body: JSON.stringify({ standings: [VALID_STANDING] }) })),
    ),
  );

  it.effect("fails with a ScrapeError on a non-ok response", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Squiggle.use((squiggle) => squiggle.fetchStandings(2024)));

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toContain("404");
    }).pipe(Effect.provide(squiggleWith({ body: "Not Found", status: 404 }))),
  );

  it.effect("fails with a ScrapeError when the standings shape fails schema validation", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Squiggle.use((squiggle) => squiggle.fetchStandings(2024)));

      expect(error).toBeInstanceOf(ScrapeError);
      expect(error.message).toMatch(/^Invalid Squiggle standings response/);
    }).pipe(
      // rank must be a number — passing a string breaks the schema
      Effect.provide(
        squiggleWith({
          body: JSON.stringify({ standings: [{ ...VALID_STANDING, rank: "first" }] }),
        }),
      ),
    ),
  );
});
