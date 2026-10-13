import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { batched } from "../../src/lib/batched";

describe("batched", () => {
  it.effect("processes all items and returns results in order", () =>
    Effect.gen(function* () {
      const results = yield* batched([1, 2, 3, 4, 5, 6, 7], (n) => Effect.succeed(n * 2), {
        batchSize: 3,
      });

      expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
    }),
  );

  it.effect("limits concurrency to the batch size", () => {
    let inFlight = 0;
    let maxInFlight = 0;

    return Effect.gen(function* () {
      yield* batched(
        Array.from({ length: 10 }, (_, i) => i),
        () =>
          Effect.gen(function* () {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            yield* Effect.yieldNow;
            inFlight--;
          }),
        { batchSize: 3 },
      );
      expect(maxInFlight).toBe(3);
    });
  });

  it.effect("defaults to a batch size of 5", () => {
    let inFlight = 0;
    let maxInFlight = 0;

    return Effect.gen(function* () {
      yield* batched(
        Array.from({ length: 12 }, (_, i) => i),
        () =>
          Effect.gen(function* () {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            yield* Effect.yieldNow;
            inFlight--;
          }),
      );
      expect(maxInFlight).toBe(5);
    });
  });

  it.effect("handles empty and single-item input", () =>
    Effect.gen(function* () {
      expect(yield* batched([], (n: number) => Effect.succeed(n))).toEqual([]);
      expect(yield* batched([7], (n) => Effect.succeed(n + 1))).toEqual([8]);
    }),
  );

  it.effect("pauses between batches but not after the last batch", () => {
    const started: number[] = [];

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        batched(
          [1, 2, 3, 4],
          (n) =>
            Effect.sync(() => {
              started.push(n);
            }),
          { batchSize: 2, gap: "300 millis" },
        ),
      );

      yield* Effect.yieldNow;
      expect(started).toEqual([1, 2]);
      yield* TestClock.adjust("299 millis");
      expect(started).toEqual([1, 2]);
      yield* TestClock.adjust("1 millis");
      yield* Fiber.join(fiber);
      expect(started).toEqual([1, 2, 3, 4]);
    });
  });

  it.effect("fails with the first failure from the mapping function", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        batched([1, 2, 3], (n) => (n === 2 ? Effect.fail("boom") : Effect.succeed(n))),
      );

      expect(error).toBe("boom");
    }),
  );
});
