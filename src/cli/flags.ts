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
    description: "Data source: afl-api, footywire, afl-tables, squiggle, fryzigg",
    default: "afl-api",
  },
} as const;

/**
 * Data source flag with no default — for commands where the appropriate
 * default depends on a runtime branch (e.g. `stats --by team` defaults to
 * afl-tables, `stats --by player` defaults to afl-api).
 */
export const OPTIONAL_SOURCE_FLAG = {
  source: {
    type: "string" as const,
    description: "Data source: afl-api, footywire, afl-tables, squiggle, fryzigg",
  },
} as const;

/** Competition code flag. */
export const COMPETITION_FLAG = {
  competition: {
    type: "string" as const,
    description: "Competition code (AFLM, AFLW, VFL, VFLW)",
    default: "AFLM",
    alias: "c",
  },
} as const;

/** Optional competition code flag (no default). */
export const OPTIONAL_COMPETITION_FLAG = {
  competition: {
    type: "string" as const,
    description: "Competition code (AFLM, AFLW, VFL, VFLW)",
    alias: "c",
  },
} as const;

/** Output format flags shared across all commands. */
export const OUTPUT_FLAGS = {
  json: { type: "boolean" as const, description: "Output as JSON", alias: "j" },
  csv: { type: "boolean" as const, description: "Output as CSV" },
  format: { type: "string" as const, description: "Output format: table, json, csv", alias: "o" },
  full: { type: "boolean" as const, description: "Show all columns in table output" },
} as const;

/** Team name flag (required). */
export const REQUIRED_TEAM_FLAG = {
  team: {
    type: "string" as const,
    description: "Team name or abbreviation (e.g. Carlton, CARL)",
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

/** Match ID flag (optional filter — narrows to one specific match). */
export const MATCH_ID_FLAG = {
  id: {
    type: "string" as const,
    description: "Specific match ID (provider-assigned, e.g. CD_M20250140101)",
  },
} as const;

/** Match status filter flag (Upcoming, Complete, Live, Postponed, Cancelled). */
export const STATUS_FLAG = {
  status: {
    type: "string" as const,
    description: "Filter by match status (Upcoming, Live, Complete, Postponed, Cancelled)",
  },
} as const;

/** Award type flag for the awards command. */
export const AWARD_TYPE_FLAG = {
  type: {
    type: "string" as const,
    description: "Award type (brownlow, coleman, coaches, all-australian, rising-star)",
    required: true,
  },
} as const;

/** Grouping flag for the stats command (--by player|team). */
export const BY_FLAG = {
  by: {
    type: "string" as const,
    description: "Group stats by: player (default) or team",
    default: "player",
  },
} as const;
