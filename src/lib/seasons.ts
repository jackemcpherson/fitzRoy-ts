import type { CompetitionCode, SeasonSelector } from "../types";
import { AmbiguousSeasonError, ValidationError } from "./errors";
import { Result } from "effect";

/** Calendar year of a validated season selector. */
export function seasonYear(season: SeasonSelector): number {
  return Number(String(season).slice(0, 4));
}

/**
 * Validate a selector before provider I/O, rejecting AFLW's ambiguous calendar year.
 * @param competition - Competition whose season is requested.
 * @param selector - Numeric year or canonical key.
 * @returns Canonical key, or an explicit ambiguity/validation error.
 */
export function canonicalSeasonKey(
  competition: CompetitionCode,
  selector: SeasonSelector,
): Result.Result<string, ValidationError | AmbiguousSeasonError> {
  const key = String(selector);

  if (!/^\d{4}(?:-S[67])?$/.test(key))
    return Result.fail(new ValidationError({ message: `Invalid season selector: ${key}` }));

  if (competition === "AFLW" && key === "2022")
    return Result.fail(
      new AmbiguousSeasonError({ competition, year: 2022, validSelectors: ["2022-S6", "2022-S7"] }),
    );

  if (key.includes("-S") && (competition !== "AFLW" || !["2022-S6", "2022-S7"].includes(key))) {
    return Result.fail(
      new ValidationError({ message: `Season ${key} does not belong to ${competition}` }),
    );
  }

  return Result.succeed(key);
}
