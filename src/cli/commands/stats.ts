/**
 * `stats` command — performance numbers per player or aggregated by team.
 *
 * Default `--by player` → fetchPlayerStats (per-player per-match rows).
 * `--by team` → fetchTeamStats (per-team season aggregates from
 *   FootyWire/AFL Tables; AFL API doesn't expose team aggregates).
 */

import { defineCommand } from "citty";
import pc from "picocolors";
import { fetchPlayerStats, fetchTeamStats } from "../../index";
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
import { applyStatsFilters } from "../stats-filters";
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
  { key: "for.kicks", label: "K", maxWidth: 6 },
  { key: "for.handballs", label: "HB", maxWidth: 6 },
  { key: "for.disposals", label: "D", maxWidth: 6 },
  { key: "for.marks", label: "M", maxWidth: 6 },
  { key: "for.goals", label: "G", maxWidth: 6 },
  { key: "for.behinds", label: "B", maxWidth: 6 },
  { key: "for.tackles", label: "T", maxWidth: 6 },
  { key: "for.inside50s", label: "I50", maxWidth: 6 },
];

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
      console.log(formatOutput(result.data as readonly object[], formatOptions));
      return;
    }

    const source: DataSource = args.source
      ? validateSource(args.source)
      : playerStatsRegistry.defaultSource;

    const matchResolution = await resolveMatchId({
      matchIdArg: args.id as string | undefined,
      matchArg: args.match,
      competition,
      season,
      round,
    });

    const teamFilter = args.team ? await resolveTeamNameOrPrompt(args.team) : undefined;

    const result = await withSpinner("Fetching player stats…", () =>
      fetchPlayerStats({
        source,
        season,
        round,
        matchId: matchResolution?.matchId,
        competition,
      }),
    );
    if (!result.success) throw result.error;

    // Season scrapes can lose individual games — warn (on stderr, so JSON/CSV
    // stdout output stays clean) rather than silently presenting a partial
    // season as complete.
    const { failedMatchIds } = result.data;
    if (failedMatchIds.length > 0) {
      console.error(
        pc.yellow(
          `Warning: ${failedMatchIds.length} game(s) failed to fetch and are missing from the results: ${failedMatchIds.join(", ")}`,
        ),
      );
    }

    const data = applyStatsFilters(result.data.stats, {
      participants: matchResolution?.participants,
      team: teamFilter,
      player: args.player,
    });

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
