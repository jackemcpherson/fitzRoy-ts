import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fetchLadder } from "../../src/api/ladder";
import { fetchLineup } from "../../src/api/lineup";
import { fixtureFitzroy } from "../support/services";

describe("public API source validation", () => {
  it.effect("fetchLineup fails for non-afl-api source", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLineup({
          source: "footywire",
          season: 2025,
          round: 1,
        }),
      );

      expect(error.message).toContain("footywire does not provide lineup");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fetchLadder fails for footywire source", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLadder({
          source: "footywire",
          season: 2025,
        }),
      );

      expect(error.message).toContain("footywire does not provide ladder");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fetchLineup fails for squiggle source", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLineup({
          source: "squiggle",
          season: 2025,
          round: 1,
        }),
      );

      expect(error.message).toContain("squiggle does not provide lineup");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );
});
