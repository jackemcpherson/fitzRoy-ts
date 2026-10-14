/**
 * Tests for the CLI failure formatter. Colour codes are stripped, so the
 * strings compare as plain text whether or not colour is enabled.
 */

import { stripVTControlCharacters as plain } from "node:util";
import { Cause } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { formatCause, formatError } from "../../src/cli/error-boundary";
import { CliUsageError } from "../../src/cli/errors";
import {
  AflApiError,
  AmbiguousSeasonError,
  IncompleteDataError,
  OutOfRangeError,
  ScrapeError,
  UnsupportedCompetitionError,
  UnsupportedSourceError,
  ValidationError,
} from "../../src/lib/errors";
import { RequestError } from "../../src/lib/http";

describe("formatError", () => {
  it("lists validation issues", () => {
    const error = new ValidationError({
      message: "bad",
      issues: [
        { path: "season", message: "Expected a number" },
        { path: "round", message: "Expected an integer" },
      ],
    });

    expect(plain(formatError(error))).toBe(
      "Validation error:\n  season: Expected a number\n  round: Expected an integer",
    );
  });

  it("prints a validation error without issues as a plain error", () => {
    expect(plain(formatError(new ValidationError({ message: "bad payload" })))).toBe(
      "Error: bad payload",
    );
  });

  it("adds the HTTP status to an AFL API error when present", () => {
    expect(plain(formatError(new AflApiError({ message: "denied", statusCode: 403 })))).toBe(
      "AFL API error: denied (HTTP 403)",
    );
    expect(plain(formatError(new AflApiError({ message: "offline" })))).toBe(
      "AFL API error: offline",
    );
  });

  it("adds the source to a scrape error when present", () => {
    expect(plain(formatError(new ScrapeError({ message: "gone", source: "footywire" })))).toBe(
      "Scrape error: gone [footywire]",
    );
    expect(plain(formatError(new ScrapeError({ message: "gone" })))).toBe("Scrape error: gone");
  });

  it("labels unsupported sources", () => {
    expect(plain(formatError(new UnsupportedSourceError({ message: "no ladder" })))).toBe(
      "Unsupported source: no ladder",
    );
  });

  it("suggests another source for an unsupported competition", () => {
    const error = new UnsupportedCompetitionError({
      message: "squiggle has no AFLW",
      source: "squiggle",
      competition: "AFLW",
      suggestion: "--source afl-api",
    });

    expect(plain(formatError(error))).toBe(
      "Unsupported competition: squiggle has no AFLW\n  Try: --source afl-api",
    );
  });

  it("suggests another source for an out-of-range season", () => {
    const error = new OutOfRangeError({
      message: "afl-api starts in 2012",
      source: "afl-api",
      competition: "AFLM",
      season: 1990,
      suggestion: "--source afl-tables",
    });

    expect(plain(formatError(error))).toBe(
      "Season out of range: afl-api starts in 2012\n  Try: --source afl-tables",
    );
  });

  it.each([
    new CliUsageError({ message: "Unknown flag" }),
    new IncompleteDataError({ message: "Unknown flag" }),
    new RequestError({ message: "Unknown flag" }),
  ])("prints other failures as a plain error (%#)", (error) => {
    expect(plain(formatError(error))).toBe("Error: Unknown flag");
  });

  it("prints an ambiguous season with its derived message", () => {
    const error = new AmbiguousSeasonError({
      competition: "AFLW",
      year: 2022,
      validSelectors: ["2022-S6", "2022-S7"],
    });

    expect(plain(formatError(error))).toBe(
      "Error: Ambiguous AFLW season 2022; choose 2022-S6 or 2022-S7",
    );
  });
});

describe("formatCause", () => {
  it("formats the expected failure of a cause", () => {
    expect(plain(formatCause(Cause.fail(new CliUsageError({ message: "bad flag" }))))).toBe(
      "Error: bad flag",
    );
  });

  it("prints a defect as a plain error", () => {
    expect(plain(formatCause(Cause.die(new Error("boom"))))).toBe("Error: boom");
    expect(plain(formatCause(Cause.die("boom")))).toBe("Error: boom");
  });
});
