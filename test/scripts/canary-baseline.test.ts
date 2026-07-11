import { describe, expect, it } from "vitest";
import { evaluateCount, promoteBaseline, validateBaseline } from "../../scripts/canary-baseline";

describe("validateBaseline", () => {
  it("accepts an empty baseline", () => {
    expect(validateBaseline({})).toEqual({});
  });

  it("accepts finite non-negative counts", () => {
    expect(validateBaseline({ "afl-api": 1, "afl-tables": 207 })).toEqual({
      "afl-api": 1,
      "afl-tables": 207,
    });
  });

  it.each([
    null,
    [],
    "invalid",
    { source: "10" },
    { source: -1 },
    { source: Number.NaN },
  ])("rejects invalid shape %#", (value) => {
    expect(validateBaseline(value)).toBeUndefined();
  });
});

describe("evaluateCount", () => {
  it("classifies a missing prior count as a first run", () => {
    expect(evaluateCount(10, undefined, 0.85)).toEqual({ status: "first-run", observed: 10 });
  });

  it("accepts a count exactly at the 85% boundary", () => {
    expect(evaluateCount(85, 100, 0.85)).toEqual({
      status: "accepted",
      observed: 85,
      previous: 100,
    });
  });

  it("rejects a count below the 85% boundary", () => {
    expect(evaluateCount(84, 100, 0.85)).toEqual({
      status: "drift",
      observed: 84,
      previous: 100,
      floor: 85,
    });
  });

  it("accepts an increase", () => {
    expect(evaluateCount(110, 100, 0.85).status).toBe("accepted");
  });
});

describe("promoteBaseline", () => {
  it("promotes all observed counts after a successful run", () => {
    expect(promoteBaseline({ first: 10, retained: 3 }, { first: 12, added: 4 }, true)).toEqual({
      first: 12,
      retained: 3,
      added: 4,
    });
  });

  it("promotes no observed counts after any failure", () => {
    expect(promoteBaseline({ first: 10 }, { first: 8, added: 4 }, false)).toEqual({ first: 10 });
  });
});
