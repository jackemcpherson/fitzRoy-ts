import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import { OutOfRangeError, UnsupportedCompetitionError } from "../../../src/lib/errors";
import {
  type CoverageMap,
  checkCoverage,
  unsupportedSourceForOperation,
} from "../../../src/sources/adapters/coverage";

const COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 2012 }],
  ["AFLW", { minSeason: 2017 }],
  ["VFL", { minSeason: 2021, maxSeason: 2024 }],
]);

describe("checkCoverage", () => {
  it("returns ok when the season falls within the range", () => {
    const result = checkCoverage(COVERAGE, {
      source: "afl-api",
      operation: "match",
      competition: "AFLM",
      season: 2025,
    });

    expect(Result.isSuccess(result)).toBe(true);
  });

  it("returns ok at the boundary (minSeason inclusive)", () => {
    const result = checkCoverage(COVERAGE, {
      source: "afl-api",
      operation: "match",
      competition: "AFLM",
      season: 2012,
    });

    expect(Result.isSuccess(result)).toBe(true);
  });

  it("returns UnsupportedCompetitionError when competition isn't in coverage", () => {
    const result = checkCoverage(COVERAGE, {
      source: "footywire",
      operation: "match",
      competition: "VFLW",
      season: 2025,
    });

    expect(Result.isFailure(result)).toBe(true);

    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(UnsupportedCompetitionError);
      expect(result.failure.message).toContain("footywire does not provide match data for VFLW");
    }
  });

  it("returns OutOfRangeError when the season is below minSeason", () => {
    const result = checkCoverage(COVERAGE, {
      source: "afl-api",
      operation: "match",
      competition: "AFLM",
      season: 2005,
    });

    expect(Result.isFailure(result)).toBe(true);

    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(OutOfRangeError);
      expect(result.failure.message).toContain("from 2012; you asked for 2005");
    }
  });

  it("returns OutOfRangeError when the season is above maxSeason", () => {
    const result = checkCoverage(COVERAGE, {
      source: "afl-api",
      operation: "match",
      competition: "VFL",
      season: 2030,
    });

    expect(Result.isFailure(result)).toBe(true);

    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(OutOfRangeError);
      expect(result.failure.message).toContain("up to 2024; you asked for 2030");
    }
  });

  it("attaches the suggestion to the error when provided", () => {
    const result = checkCoverage(
      COVERAGE,
      {
        source: "footywire",
        operation: "match",
        competition: "VFLW",
        season: 2025,
      },
      "--source afl-api",
    );

    expect(Result.isFailure(result)).toBe(true);

    if (Result.isFailure(result) && result.failure instanceof UnsupportedCompetitionError) {
      expect(result.failure.suggestion).toBe("--source afl-api");
    }
  });

  it("leaves suggestion undefined when not provided", () => {
    const result = checkCoverage(COVERAGE, {
      source: "footywire",
      operation: "match",
      competition: "VFLW",
      season: 2025,
    });

    if (Result.isFailure(result) && result.failure instanceof UnsupportedCompetitionError) {
      expect(result.failure.suggestion).toBeUndefined();
    }
  });
});

describe("unsupportedSourceForOperation", () => {
  it("lists the registered sources in the message", () => {
    const error = unsupportedSourceForOperation("fryzigg", "ladder", [
      "afl-api",
      "afl-tables",
      "squiggle",
    ]);

    expect(error.message).toContain("fryzigg does not provide ladder");
    expect(error.message).toContain("afl-api, afl-tables, squiggle");
  });
});
