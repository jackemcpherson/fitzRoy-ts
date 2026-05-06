/**
 * Tests for Result composition combinators.
 */

import { describe, expect, it } from "vitest";
import { err, ok, Result } from "../../src/lib/result";

describe("Result.map", () => {
  it("transforms the success value", () => {
    const result = Result.map(ok(2), (n) => n * 3);
    expect(result).toEqual(ok(6));
  });

  it("passes errors through untouched", () => {
    const original = err(new Error("boom"));
    const result = Result.map(original, (n: number) => n * 3);
    expect(result).toBe(original);
  });
});

describe("Result.flatMap", () => {
  it("chains a Result-returning function on success", () => {
    const result = Result.flatMap(ok(2), (n) => ok(n + 1));
    expect(result).toEqual(ok(3));
  });

  it("short-circuits on error without calling fn", () => {
    let called = false;
    const result = Result.flatMap(err(new Error("boom")) as Result<number, Error>, (n) => {
      called = true;
      return ok(n + 1);
    });
    expect(called).toBe(false);
    expect(result.success).toBe(false);
  });

  it("propagates a downstream error", () => {
    const downstreamError = new Error("downstream");
    const result = Result.flatMap(ok(2), (_n) => err(downstreamError));
    expect(result).toEqual(err(downstreamError));
  });
});

describe("Result.flatMapAsync", () => {
  it("chains an async Result-returning function on success", async () => {
    const result = await Result.flatMapAsync(ok(2), async (n) => ok(n + 1));
    expect(result).toEqual(ok(3));
  });

  it("short-circuits on error without invoking the async fn", async () => {
    let called = false;
    const result = await Result.flatMapAsync(
      err(new Error("boom")) as Result<number, Error>,
      async (n) => {
        called = true;
        return ok(n + 1);
      },
    );
    expect(called).toBe(false);
    expect(result.success).toBe(false);
  });
});

describe("Result.all", () => {
  it("collects all successes into an ok of array", () => {
    const result = Result.all([ok(1), ok(2), ok(3)]);
    expect(result).toEqual(ok([1, 2, 3]));
  });

  it("returns the first error encountered", () => {
    const firstError = new Error("first");
    const secondError = new Error("second");
    const result = Result.all([ok(1), err(firstError), err(secondError)]);
    expect(result).toEqual(err(firstError));
  });

  it("returns ok of empty array on empty input", () => {
    const result = Result.all<number, Error>([]);
    expect(result).toEqual(ok([]));
  });
});

describe("Result.mapErr", () => {
  it("transforms the error value", () => {
    const result = Result.mapErr(err(new Error("boom")), (e) => e.message.toUpperCase());
    expect(result).toEqual(err("BOOM"));
  });

  it("passes successes through untouched", () => {
    const original = ok(2);
    const result = Result.mapErr(original, (e: Error) => e.message);
    expect(result).toBe(original);
  });
});
