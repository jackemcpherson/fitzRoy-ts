import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fetchLadder } from "../../src/api/ladder";
import { fetchMatches } from "../../src/api/match";
import { fetchPlayerStats } from "../../src/api/player-stats";
import { fetchTeamStats } from "../../src/api/team-stats";
import {
  OutOfRangeError,
  UnsupportedCompetitionError,
  UnsupportedSourceError,
} from "../../src/lib/errors";
import { requestLog } from "../support/http";
import { fixtureFitzroy } from "../support/services";

/**
 * These tests verify the registry-driven public API surfaces the right
 * structured errors with the right suggestions, without making any
 * network calls (the coverage check fails before the adapter dispatches).
 * Every request is answered by an empty fixture router (404).
 */
describe("coverage suggestions in public API", () => {
  it.effect(
    "fetchMatches with footywire+AFLW suggests --source afl-api (only afl-api covers AFLW)",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          fetchMatches({
            source: "footywire",
            season: 2025,
            competition: "AFLW",
          }),
        );

        expect(error).toBeInstanceOf(UnsupportedCompetitionError);

        if (error instanceof UnsupportedCompetitionError) {
          expect(error.suggestion).toBe("--source afl-api");
        }
      }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fetchMatches with afl-tables+AFLM+1990 passes the coverage check", () => {
    // afl-tables covers AFLM from 1897, so the coverage check passes and the
    // adapter dispatches. The fixture router answers 404, so the request
    // fails with a source error rather than a coverage error.
    const log = requestLog();

    return Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchMatches({
          source: "afl-tables",
          season: 1990,
          competition: "AFLM",
        }),
      );

      expect(error).not.toBeInstanceOf(UnsupportedCompetitionError);
      expect(error).not.toBeInstanceOf(OutOfRangeError);
      expect(log.urls.length).toBeGreaterThan(0);
    }).pipe(Effect.provide(fixtureFitzroy([], log)));
  });

  it.effect("fetchMatches with afl-api+AFLM+1990 fails with OutOfRangeError", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchMatches({
          source: "afl-api",
          season: 1990,
          competition: "AFLM",
        }),
      );

      expect(error).toBeInstanceOf(OutOfRangeError);
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fetchPlayerStats with squiggle fails with UnsupportedSourceError (not registered)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchPlayerStats({
          source: "squiggle",
          season: 2025,
          round: 1,
        }),
      );

      expect(error).toBeInstanceOf(UnsupportedSourceError);
      expect(error.message).toContain("squiggle does not provide player stats");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect(
    "fetchLadder with fryzigg fails with UnsupportedSourceError (not registered for ladder)",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(fetchLadder({ source: "fryzigg", season: 2025 }));

        expect(error).toBeInstanceOf(UnsupportedSourceError);
      }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect(
    "fetchTeamStats with afl-api fails with UnsupportedSourceError (no team-stats endpoint)",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(fetchTeamStats({ source: "afl-api", season: 2024 }));

        expect(error).toBeInstanceOf(UnsupportedSourceError);
      }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("OutOfRangeError below minSeason includes the minSeason in the message", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchPlayerStats({
          source: "afl-tables",
          season: 1900,
          competition: "AFLM",
        }),
      );

      expect(error).toBeInstanceOf(OutOfRangeError);
      expect(error.message).toContain("1965");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );
});
