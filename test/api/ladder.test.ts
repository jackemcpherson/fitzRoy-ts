import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fetchLadder } from "../../src/api/ladder";
import { fixtureText, type Route, requestLog } from "../support/http";
import { fixtureFitzroy } from "../support/services";

/** Each AFL-API URL the ladder flow requests, routed to its fixture. */
const LADDER_ROUTES: readonly Route[] = [
  ["compseasons?pageSize", { body: fixtureText("afl-api-compseasons-2024.json") }],
  ["/rounds?", { body: fixtureText("afl-api-rounds-2024.json") }],
  ["/ladders", { body: fixtureText("afl-api-ladder-2024-r10.json") }],
  [
    /./,
    {
      respond: (url) => Promise.reject(new Error(`Unexpected URL in ladder test: ${url}`)),
    },
  ],
];

describe("fetchLadder afl-api happy path", () => {
  it.effect("resolves comp-season, rounds, then ladder and flattens entries", () =>
    Effect.gen(function* () {
      const ladder = yield* fetchLadder({ source: "afl-api", season: 2024 });

      expect(ladder.season).toBe(2024);
      expect(ladder.competition).toBe("AFLM");
      expect(ladder.source).toBe("afl-api");
      expect(ladder.roundNumber).toBe(10);
      expect(ladder.entries).toHaveLength(18);

      const leader = ladder.entries[0];
      expect(leader?.position).toBe(1);
      expect(leader?.team).toBe("Sydney Swans");
      expect(leader?.wins).toBe(9);
      expect(leader?.losses).toBe(1);
      expect(leader?.premiershipsPoints).toBe(36);
      expect(leader?.percentage).toBe(154.7);
    }).pipe(Effect.provide(fixtureFitzroy(LADDER_ROUTES))),
  );

  it.effect("honours an explicit round number", () =>
    Effect.gen(function* () {
      const ladder = yield* fetchLadder({ source: "afl-api", season: 2024, round: 10 });

      expect(ladder.entries[0]?.team).toBe("Sydney Swans");
    }).pipe(Effect.provide(fixtureFitzroy(LADDER_ROUTES))),
  );

  it.effect("rejects an explicit round that does not exist without fetching a ladder", () => {
    const log = requestLog();

    return Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLadder({ source: "afl-api", season: 2024, round: 999 }),
      );

      expect(error.message).toContain("999");
      expect(error.message).toContain("2024");
      expect(log.urls.some((url) => url.includes("/ladders"))).toBe(false);
    }).pipe(Effect.provide(fixtureFitzroy(LADDER_ROUTES, log)));
  });
});

describe("fetchLadder public API dispatch", () => {
  it.effect("fails for footywire source (not registered for ladder)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLadder({
          source: "footywire",
          season: 2024,
        }),
      );

      expect(error.message).toContain("footywire does not provide ladder");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for fryzigg source (not registered for ladder)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLadder({
          source: "fryzigg",
          season: 2024,
        }),
      );

      expect(error.message).toContain("fryzigg does not provide ladder");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for season below afl-api coverage (pre-2012)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLadder({
          source: "afl-api",
          season: 2010,
        }),
      );

      expect(error.message).toContain("2010");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for AFLW season below afl-api coverage (pre-2017)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLadder({
          source: "afl-api",
          season: 2016,
          competition: "AFLW",
        }),
      );

      expect(error.message).toContain("2016");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );
});
