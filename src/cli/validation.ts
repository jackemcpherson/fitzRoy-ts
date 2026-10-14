/**
 * Shared CLI input validation helpers.
 *
 * Each function validates a raw CLI string argument and returns a `Result`:
 * the typed value, or a {@link CliUsageError} that describes the problem.
 */

import { Result } from "effect";
import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchItem } from "../lib/validation";
import type {
  AwardType,
  CompetitionCode,
  DataSource,
  MatchStatus,
  SeasonSelector,
  TeamStatsSummaryType,
} from "../types";
import { CliUsageError } from "./errors";

const VALID_SOURCES: readonly DataSource[] = [
  "afl-api",
  "footywire",
  "afl-tables",
  "squiggle",
  "fryzigg",
];

const VALID_COMPETITIONS: readonly CompetitionCode[] = ["AFLM", "AFLW", "VFL", "VFLW"];

const VALID_FORMATS = ["table", "json", "csv"] as const;

type OutputFormat = (typeof VALID_FORMATS)[number];

const VALID_SUMMARIES = ["totals", "averages"] as const;

const VALID_AWARD_TYPES: readonly AwardType[] = [
  "brownlow",
  "all-australian",
  "rising-star",
  "coleman",
  "coaches",
];

const VALID_MATCH_STATUSES: readonly MatchStatus[] = [
  "Upcoming",
  "Live",
  "Complete",
  "Postponed",
  "Cancelled",
];

const VALID_GROUP_BY = ["player", "team"] as const;

export type GroupBy = (typeof VALID_GROUP_BY)[number];

/** A validated CLI value, or the usage error that rejects it. */
export type Validated<A> = Result.Result<A, CliUsageError>;

/** Reject a CLI value with a usage error. */
export function usage(message: string): Validated<never> {
  return Result.fail(new CliUsageError({ message }));
}

/** Find `raw` in a list of valid values, keeping the value's literal type. */
function findValid<A extends string>(valid: readonly A[], raw: string): A | undefined {
  return valid.find((value) => value === raw);
}

/** Validate and parse a season year string. */
export function validateSeason(raw: string): Validated<SeasonSelector> {
  if (raw === "2022-S6" || raw === "2022-S7") return Result.succeed(raw);
  const season = Number(raw);

  if (Number.isNaN(season) || !Number.isInteger(season)) {
    return usage(`Invalid season: "${raw}" — season must be a number (e.g. 2025)`);
  }

  if (season < 1897 || season > 2100) {
    return usage(`Invalid season: ${season} — must be between 1897 and 2100`);
  }

  return Result.succeed(season);
}

/** Validate and parse an optional season year string. */
export function validateOptionalSeason(
  raw: string | undefined,
): Validated<SeasonSelector | undefined> {
  if (raw != null) return validateSeason(raw);

  return Result.succeed(undefined);
}

export { resolveDefaultSeason } from "../lib/date-utils";

/** Validate and parse a round number string. */
export function validateRound(raw: string): Validated<number> {
  const round = Number(raw);

  if (Number.isNaN(round) || !Number.isInteger(round) || round < 0) {
    return usage(`Invalid round: "${raw}" — round must be a non-negative integer`);
  }

  return Result.succeed(round);
}

/** Validate and parse a positive integer limit string. */
export function validateLimit(raw: string | undefined): Validated<number | undefined> {
  if (raw == null) return Result.succeed(undefined);
  const limit = Number(raw);

  if (Number.isNaN(limit) || !Number.isInteger(limit) || limit <= 0) {
    return usage(`Invalid limit: "${raw}" — must be a positive integer`);
  }

  return Result.succeed(limit);
}

/** Validate an output format string. */
export function validateFormat(raw: string | undefined): Validated<OutputFormat | undefined> {
  if (raw == null) return Result.succeed(undefined);
  const format = findValid(VALID_FORMATS, raw.toLowerCase());

  if (format !== undefined) return Result.succeed(format);

  return usage(`Invalid format: "${raw}" — valid formats are: ${VALID_FORMATS.join(", ")}`);
}

/** Validate a competition code string (case-insensitive). */
export function validateCompetition(raw: string): Validated<CompetitionCode> {
  const competition = findValid(VALID_COMPETITIONS, raw.toUpperCase());

  if (competition !== undefined) return Result.succeed(competition);

  return usage(
    `Invalid competition: "${raw}" — valid values are: ${VALID_COMPETITIONS.join(", ")}`,
  );
}

/** Validate a competition code string if provided, otherwise return undefined. */
export function validateOptionalCompetition(
  raw: string | undefined,
): Validated<CompetitionCode | undefined> {
  if (raw == null) return Result.succeed(undefined);

  return validateCompetition(raw);
}

/** Validate a data source string. */
export function validateSource(raw: string): Validated<DataSource> {
  const source = findValid(VALID_SOURCES, raw);

  if (source !== undefined) return Result.succeed(source);

  return usage(`Invalid source: "${raw}" — valid sources are: ${VALID_SOURCES.join(", ")}`);
}

/** Validate a provider-specific match identifier before any fetch occurs. */
export function validateMatchId(source: DataSource, raw: string): Validated<string> {
  const patterns: Partial<Record<DataSource, RegExp>> = {
    "afl-api": /^CD_M\d+$/,
    footywire: /^FW_(?:\d+|SYNTH_\d+_R\d+_G\d+)$/,
    "afl-tables": /^AT_(?:\d+|SYNTH_\d+_\d+)$/,
    squiggle: /^SQ_\d+$/,
    fryzigg: /^\d+$/,
  };

  const examples: Partial<Record<DataSource, string>> = {
    "afl-api": "CD_M20250140101",
    footywire: "FW_11193 or FW_SYNTH_2025_R5_G1",
    "afl-tables": "AT_111620240307 or AT_SYNTH_2024_1",
    squiggle: "SQ_12345",
    fryzigg: "10001",
  };

  const pattern = patterns[source];

  if (pattern?.test(raw)) return Result.succeed(raw);
  const example = examples[source];

  return usage(
    example === undefined
      ? `${source} does not accept match identifiers.`
      : `Invalid match ID "${raw}" for ${source}; expected ${example}.`,
  );
}

/** Validate a summary type string (case-insensitive). */
export function validateSummary(raw: string): Validated<TeamStatsSummaryType> {
  const summary = findValid(VALID_SUMMARIES, raw.toLowerCase());

  if (summary !== undefined) return Result.succeed(summary);

  return usage(`Invalid summary type: "${raw}" — valid values are: ${VALID_SUMMARIES.join(", ")}`);
}

/** Validate an award type string (case-insensitive). */
export function validateAwardType(raw: string): Validated<AwardType> {
  const award = findValid(VALID_AWARD_TYPES, raw.toLowerCase());

  if (award !== undefined) return Result.succeed(award);

  return usage(`Invalid award type: "${raw}" — valid values are: ${VALID_AWARD_TYPES.join(", ")}`);
}

/** Validate a match status string (case-insensitive). */
export function validateMatchStatus(raw: string): Validated<MatchStatus> {
  const lower = raw.toLowerCase();
  const status = VALID_MATCH_STATUSES.find((valid) => valid.toLowerCase() === lower);

  if (status !== undefined) return Result.succeed(status);

  return usage(`Invalid status: "${raw}" — valid values are: ${VALID_MATCH_STATUSES.join(", ")}`);
}

/** Validate a --by grouping flag. */
export function validateGroupBy(raw: string): Validated<GroupBy> {
  const groupBy = findValid(VALID_GROUP_BY, raw.toLowerCase());

  if (groupBy !== undefined) return Result.succeed(groupBy);

  return usage(`Invalid --by value: "${raw}" — valid values are: ${VALID_GROUP_BY.join(", ")}`);
}

/**
 * Resolve a team identifier from a numeric ID, abbreviation, or name.
 *
 * Uses `normaliseTeamName` from team-mapping to leverage the existing alias map,
 * then matches against the teams list for the numeric ID.
 *
 * @param raw - The user-provided team identifier string.
 * @param teams - Array of teams from fetchTeams() for ID lookup.
 * @returns The numeric team ID string, or an unknown-team usage error.
 */
export function resolveTeamIdentifier(
  raw: string,
  teams: readonly { teamId: string; name: string; abbreviation: string }[],
): Validated<string> {
  const trimmed = raw.trim();

  // If it's already a numeric ID, return as-is
  if (/^\d+$/.test(trimmed)) {
    return Result.succeed(trimmed);
  }

  // Use the existing alias map to normalise abbreviations and common names
  const canonical = normaliseTeamName(trimmed);
  const byCanonical = teams.find((t) => t.name === canonical);

  if (byCanonical) return Result.succeed(byCanonical.teamId);

  // Fallback: try case-insensitive match on team name and abbreviation
  const lower = trimmed.toLowerCase();
  const byName = teams.find((t) => t.name.toLowerCase() === lower);

  if (byName) return Result.succeed(byName.teamId);

  const byAbbrev = teams.find((t) => t.abbreviation.toLowerCase() === lower);

  if (byAbbrev) return Result.succeed(byAbbrev.teamId);

  const validNames = teams.map((t) => `${t.name} (${t.abbreviation})`).join(", ");

  return usage(`Unknown team: "${raw}" — valid teams are: ${validNames}`);
}

/** Label a match as "Home vs Away" using canonical team names. */
function matchLabel(item: MatchItem): string {
  return `${normaliseTeamName(item.match.homeTeam.name)} vs ${normaliseTeamName(item.match.awayTeam.name)}`;
}

/**
 * Resolve a match ID from a team name by searching the round's match items.
 *
 * Matches where either the home or away team contains the search term
 * (case-insensitive, also tried via normaliseTeamName).
 *
 * @param teamSearch - The user-provided team name to search for.
 * @param matchItems - Match items for the round.
 * @returns The resolved match ID, or a usage error when zero or multiple
 *   matches are found.
 */
export function resolveMatchByTeam(
  teamSearch: string,
  matchItems: readonly MatchItem[],
): Validated<string> {
  const normalised = normaliseTeamName(teamSearch);
  const lower = teamSearch.toLowerCase();

  const matches = matchItems.filter((item) => {
    const home = item.match.homeTeam.name;
    const away = item.match.awayTeam.name;

    return (
      normaliseTeamName(home) === normalised ||
      normaliseTeamName(away) === normalised ||
      home.toLowerCase().includes(lower) ||
      away.toLowerCase().includes(lower)
    );
  });

  const singleMatch = matches[0];

  if (matches.length === 1 && singleMatch) {
    return Result.succeed(singleMatch.match.matchId);
  }

  if (matches.length === 0) {
    const available = matchItems.map(matchLabel).join(", ");

    return usage(
      `No match found for "${teamSearch}" in this round. Available matches: ${available}`,
    );
  }

  const ambiguous = matches.map(matchLabel).join(", ");

  return usage(
    `Multiple matches found for "${teamSearch}": ${ambiguous}. Please be more specific.`,
  );
}
