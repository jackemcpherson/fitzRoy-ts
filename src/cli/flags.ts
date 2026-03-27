/**
 * Shared CLI flag definitions for citty commands.
 *
 * Centralises flag names, descriptions, defaults, and short aliases
 * so that all commands share a consistent interface.
 */

/** Season year flag (required). */
export const SEASON_FLAG = {
  season: {
    type: "string" as const,
    description: "Season year (e.g. 2025)",
    required: true,
    alias: "s",
  },
} as const;

/** Season year flag (optional). */
export const OPTIONAL_SEASON_FLAG = {
  season: {
    type: "string" as const,
    description: "Season year (e.g. 2025)",
    alias: "s",
  },
} as const;

/** Round number flag (optional). */
export const ROUND_FLAG = {
  round: {
    type: "string" as const,
    description: "Round number",
    alias: "r",
  },
} as const;

/** Round number flag (required). */
export const REQUIRED_ROUND_FLAG = {
  round: {
    type: "string" as const,
    description: "Round number",
    required: true,
    alias: "r",
  },
} as const;

/** Data source flag. */
export const SOURCE_FLAG = {
  source: {
    type: "string" as const,
    description: "Data source",
    default: "afl-api",
  },
} as const;

/** Competition code flag. */
export const COMPETITION_FLAG = {
  competition: {
    type: "string" as const,
    description: "Competition code (AFLM or AFLW)",
    default: "AFLM",
    alias: "c",
  },
} as const;

/** Optional competition code flag (no default). */
export const OPTIONAL_COMPETITION_FLAG = {
  competition: {
    type: "string" as const,
    description: "Competition code (AFLM or AFLW)",
    alias: "c",
  },
} as const;

/** Output format flags shared across all commands. */
export const OUTPUT_FLAGS = {
  json: { type: "boolean" as const, description: "Output as JSON", alias: "j" },
  csv: { type: "boolean" as const, description: "Output as CSV" },
  format: { type: "string" as const, description: "Output format: table, json, csv" },
  full: { type: "boolean" as const, description: "Show all columns in table output" },
} as const;

/** Team name flag (required). */
export const REQUIRED_TEAM_FLAG = {
  team: {
    type: "string" as const,
    description: "Team name, abbreviation, or ID (e.g. Carlton, CARL, 5)",
    required: true,
    alias: "t",
  },
} as const;

/** Team name flag (optional filter). */
export const TEAM_FLAG = {
  team: {
    type: "string" as const,
    description: "Filter by team name",
    alias: "t",
  },
} as const;

/** Player name flag (optional filter). */
export const PLAYER_FLAG = {
  player: {
    type: "string" as const,
    description: "Filter by player name",
    alias: "p",
  },
} as const;
