/**
 * Shared CLI input validation helpers.
 *
 * Each function validates a raw CLI string argument and returns the typed value,
 * or throws a descriptive error if invalid.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import type { CompetitionCode, DataSource } from "../types";

const VALID_SOURCES: readonly DataSource[] = ["afl-api", "footywire", "afl-tables", "squiggle"];
const VALID_COMPETITIONS: readonly CompetitionCode[] = ["AFLM", "AFLW"];
const VALID_FORMATS = ["table", "json", "csv"] as const;
type OutputFormat = (typeof VALID_FORMATS)[number];

/** Validate and parse a season year string. */
export function validateSeason(raw: string): number {
  const season = Number(raw);
  if (Number.isNaN(season) || !Number.isInteger(season)) {
    throw new Error(`Invalid season: "${raw}" — season must be a number (e.g. 2025)`);
  }
  if (season < 1897 || season > 2100) {
    throw new Error(`Invalid season: ${season} — must be between 1897 and 2100`);
  }
  return season;
}

/** Validate and parse an optional season year string. */
export function validateOptionalSeason(raw: string | undefined): number | undefined {
  if (raw != null) return validateSeason(raw);
  return undefined;
}

/** Resolve the default season for a competition when none is provided. */
export function resolveDefaultSeason(competition: CompetitionCode = "AFLM"): number {
  const year = new Date().getFullYear();
  return competition === "AFLW" ? year - 1 : year;
}

/** Validate and parse a round number string. */
export function validateRound(raw: string): number {
  const round = Number(raw);
  if (Number.isNaN(round) || !Number.isInteger(round) || round < 0) {
    throw new Error(`Invalid round: "${raw}" — round must be a non-negative integer`);
  }
  return round;
}

/** Validate an output format string. */
export function validateFormat(raw: string | undefined): OutputFormat | undefined {
  if (raw == null) return undefined;
  const lower = raw.toLowerCase();
  if (VALID_FORMATS.includes(lower as OutputFormat)) {
    return lower as OutputFormat;
  }
  throw new Error(`Invalid format: "${raw}" — valid formats are: ${VALID_FORMATS.join(", ")}`);
}

/** Validate a competition code string (case-insensitive). */
export function validateCompetition(raw: string): CompetitionCode {
  const upper = raw.toUpperCase();
  if (upper === "AFLM" || upper === "AFLW") {
    return upper;
  }
  throw new Error(
    `Invalid competition: "${raw}" — valid values are: ${VALID_COMPETITIONS.join(", ")}`,
  );
}

/** Validate a competition code string if provided, otherwise return undefined. */
export function validateOptionalCompetition(raw: string | undefined): CompetitionCode | undefined {
  if (raw == null) return undefined;
  return validateCompetition(raw);
}

/** Validate a data source string. */
export function validateSource(raw: string): DataSource {
  if (VALID_SOURCES.includes(raw as DataSource)) {
    return raw as DataSource;
  }
  throw new Error(`Invalid source: "${raw}" — valid sources are: ${VALID_SOURCES.join(", ")}`);
}

/**
 * Resolve a team identifier from a numeric ID, abbreviation, or name.
 *
 * Uses `normaliseTeamName` from team-mapping to leverage the existing alias map,
 * then matches against the teams list for the numeric ID.
 *
 * @param raw - The user-provided team identifier string.
 * @param teams - Array of teams from fetchTeams() for ID lookup.
 * @returns The numeric team ID string.
 */
export function resolveTeamIdentifier(
  raw: string,
  teams: readonly { teamId: string; name: string; abbreviation: string }[],
): string {
  const trimmed = raw.trim();

  // If it's already a numeric ID, return as-is
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Use the existing alias map to normalise abbreviations and common names
  const canonical = normaliseTeamName(trimmed);
  const byCanonical = teams.find((t) => t.name === canonical);
  if (byCanonical) return byCanonical.teamId;

  // Fallback: try case-insensitive match on team name and abbreviation
  const lower = trimmed.toLowerCase();
  const byName = teams.find((t) => t.name.toLowerCase() === lower);
  if (byName) return byName.teamId;

  const byAbbrev = teams.find((t) => t.abbreviation.toLowerCase() === lower);
  if (byAbbrev) return byAbbrev.teamId;

  const validNames = teams.map((t) => `${t.name} (${t.abbreviation})`).join(", ");
  throw new Error(`Unknown team: "${raw}" — valid teams are: ${validNames}`);
}
