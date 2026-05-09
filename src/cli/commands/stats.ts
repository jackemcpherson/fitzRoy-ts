/**
 * `stats` command — performance numbers per player or aggregated by team.
 *
 * Default `--by player` → fetchPlayerStats (per-player per-match rows).
 * `--by team` → fetchTeamStats (per-team season aggregates from
 *   FootyWire/AFL Tables; AFL API doesn't expose team aggregates).
 */

import { defineCommand } from "citty";
import { fetchPlayerStats, fetchTeamStats } from "../../index";
import { fuzzySearch } from "../../lib/fuzzy";
import { playerStatsRegistry, teamStatsRegistry } from "../../sources/adapters/registry";
import type { DataSource } from "../../types";
import { rejectUnknownFlags } from "../command-builder";
import { withErrorBoundary } from "../error-boundary";
import {
  BY_FLAG,
  COMPETITION_FLAG,
  MATCH_ID_FLAG,
  OPTIONAL_SOURCE_FLAG,
  OUTPUT_FLAGS,
  PLAYER_FLAG,
  ROUND_FLAG,
  SEASON_FLAG,
  TEAM_FLAG,
} from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { resolveMatchId } from "../match-resolver";
import { resolveTeamNameOrPrompt } from "../resolvers";
import { showSummary, withSpinner } from "../ui";
import {
  validateCompetition,
  validateFormat,
  validateGroupBy,
  validateRound,
  validateSeason,
  validateSource,
  validateSummary,
} from "../validation";

const PLAYER_COLUMNS: TableColumnConfig[] = [
  { key: "displayName", label: "Player", maxWidth: 22 },
  { key: "team", label: "Team", maxWidth: 18 },
  { key: "disposals", label: "Disp", maxWidth: 6 },
  { key: "kicks", label: "Kicks", maxWidth: 6 },
  { key: "handballs", label: "HB", maxWidth: 6 },
  { key: "marks", label: "Marks", maxWidth: 6 },
  { key: "goals", label: "Goals", maxWidth: 6 },
];

const TEAM_COLUMNS: TableColumnConfig[] = [
  { key: "team", label: "Team", maxWidth: 24 },
  { key: "gamesPlayed", label: "GP", maxWidth: 5 },
  { key: "K", label: "K", maxWidth: 6 },
  { key: "HB", label: "HB", maxWidth: 6 },
  { key: "D", label: "D", maxWidth: 6 },
  { key: "M", label: "M", maxWidth: 6 },
  { key: "G", label: "G", maxWidth: 6 },
  { key: "B", label: "B", maxWidth: 6 },
  { key: "T", label: "T", maxWidth: 6 },
  { key: "I50", label: "I50", maxWidth: 6 },
];

/**
 * Normalise AFL Tables stat keys to the FootyWire short form so a single
 * column set works across both sources.
 */
const AFL_TABLES_KEY_MAP: Readonly<Record<string, string>> = {
  KI_for: "K",
  MK_for: "M",
  HB_for: "HB",
  DI_for: "D",
  GL_for: "G",
  BH_for: "B",
  HO_for: "HO",
  TK_for: "T",
  RB_for: "RB",
  IF_for: "IF",
  CL_for: "CL",
  CG_for: "CG",
  FF_for: "FF",
  BR_for: "BR",
  CP_for: "CP",
  UP_for: "UP",
  CM_for: "CM",
  MI_for: "MI",
  "1%_for": "1%",
  BO_for: "BO",
  GA_for: "GA",
  I50_for: "I50",
};

function flattenTeamEntries(
  data: readonly { team: string; gamesPlayed: number; stats: Readonly<Record<string, number>> }[],
): Record<string, unknown>[] {
  return data.map((entry) => {
    const { stats, ...rest } = entry;
    const normalised: Record<string, number> = {};
    for (const [key, value] of Object.entries(stats)) {
      normalised[AFL_TABLES_KEY_MAP[key] ?? key] = value;
    }
    return { ...rest, ...normalised };
  });
}

const STATS_ARGS = {
  ...SEASON_FLAG,
  ...ROUND_FLAG,
  ...BY_FLAG,
  match: { type: "string", description: "Filter by team name to find a specific match" },
  ...MATCH_ID_FLAG,
  ...OPTIONAL_SOURCE_FLAG,
  ...COMPETITION_FLAG,
  ...PLAYER_FLAG,
  ...TEAM_FLAG,
  summary: { type: "string", description: "Team-stats summary type: totals or averages" },
  ...OUTPUT_FLAGS,
} as const;

export const statsCommand = defineCommand({
  meta: {
    name: "stats",
    description: "Fetch performance stats — `--by player` (default) or `--by team`",
  },
  args: STATS_ARGS,
  run: withErrorBoundary(async ({ args }) => {
    rejectUnknownFlags(STATS_ARGS, process.argv);
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);
    const groupBy = validateGroupBy(args.by);

    if (groupBy === "team") {
      if (round != null) {
        throw new Error(
          "--round is not supported for --by team. Team-stats sources (footywire, afl-tables) only expose season-level aggregates.",
        );
      }
      const source: DataSource = args.source
        ? validateSource(args.source)
        : teamStatsRegistry.defaultSource;
      const summaryType = args.summary ? validateSummary(args.summary) : undefined;
      const result = await withSpinner("Fetching team stats…", () =>
        fetchTeamStats({
          source,
          season,
          ...(summaryType !== undefined && { summaryType }),
        }),
      );
      if (!result.success) throw result.error;
      const flat = flattenTeamEntries(result.data);
      showSummary(
        `Loaded stats for ${result.data.length} teams (${season}${summaryType ? `, ${summaryType}` : ""})`,
      );
      const formatOptions: FormatOptions = {
        json: args.json,
        csv: args.csv,
        format,
        full: args.full,
        columns: TEAM_COLUMNS,
      };
      console.log(formatOutput(flat, formatOptions));
      return;
    }

    const source: DataSource = args.source
      ? validateSource(args.source)
      : playerStatsRegistry.defaultSource;

    const matchId = await resolveMatchId({
      matchIdArg: args.id as string | undefined,
      matchArg: args.match,
      competition,
      season,
      round,
    });

    const teamFilter = args.team ? await resolveTeamNameOrPrompt(args.team) : undefined;

    const result = await withSpinner("Fetching player stats…", () =>
      fetchPlayerStats({ source, season, round, matchId, competition }),
    );
    if (!result.success) throw result.error;

    let data = result.data;
    if (teamFilter) {
      data = data.filter((p) => p.team === teamFilter);
    }
    if (args.player) {
      const playerMatches = fuzzySearch(args.player, data, (p) => p.displayName, {
        maxResults: 50,
        threshold: 0.4,
      });
      data = playerMatches.map((m) => m.item);
    }

    showSummary(
      `Loaded ${data.length} player stat lines for ${season}${round ? ` round ${round}` : ""}`,
    );
    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: PLAYER_COLUMNS,
    };
    console.log(formatOutput(data, formatOptions));
  }),
});
