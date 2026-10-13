import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { squiggleMatchSource } from "../../../src/sources/adapters/squiggle";
import { Squiggle } from "../../../src/sources/squiggle";

type GamesCall = readonly [year: number, round: number | undefined, complete: number | undefined];

/** A Squiggle service that records `fetchGames` calls and returns no games. */
function recordingSquiggle(calls: GamesCall[]) {
  return Layer.succeed(Squiggle, {
    fetchGames: (year, round, complete) => {
      calls.push([year, round, complete]);

      return Effect.succeed({ games: [] });
    },
    fetchStandings: () => Effect.succeed({ standings: [] }),
  });
}

describe("squiggleMatchSource status handling (COR-02)", () => {
  it.effect("omits the complete filter for Upcoming queries so fixtures can return", () => {
    const calls: GamesCall[] = [];

    return Effect.gen(function* () {
      const source = yield* squiggleMatchSource;

      const matches = yield* source.fetchMatches({
        source: "squiggle",
        season: 2026,
        status: "Upcoming",
      });

      expect(matches).toEqual([]);
      expect(calls).toEqual([[2026, undefined, undefined]]);
    }).pipe(Effect.provide(recordingSquiggle(calls)));
  });

  it.effect("omits the complete filter when no status is requested", () => {
    const calls: GamesCall[] = [];

    return Effect.gen(function* () {
      const source = yield* squiggleMatchSource;

      yield* source.fetchMatches({ source: "squiggle", season: 2026 });
      expect(calls).toEqual([[2026, undefined, undefined]]);
    }).pipe(Effect.provide(recordingSquiggle(calls)));
  });

  it.effect("passes complete=100 only for Complete queries", () => {
    const calls: GamesCall[] = [];

    return Effect.gen(function* () {
      const source = yield* squiggleMatchSource;

      yield* source.fetchMatches({ source: "squiggle", season: 2026, status: "Complete" });
      expect(calls).toEqual([[2026, undefined, 100]]);
    }).pipe(Effect.provide(recordingSquiggle(calls)));
  });
});
