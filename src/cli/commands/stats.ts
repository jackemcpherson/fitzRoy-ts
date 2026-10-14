/**
 * `stats` command — performance numbers per player or aggregated by team.
 *
 * Default `--by player` → fetchPlayerStats (per-player per-match rows).
 * `--by team` → fetchTeamStats (per-team season aggregates from
 *   FootyWire/AFL Tables; AFL API doesn't expose team aggregates).
 */

import { defineCommand } from "citty";
import { Effect } from "effect";
import pc from "picocolors";
import { fetchPlayerStats, fetchTeamStats, SourceRegistry } from "../../index";
import { rejectUnknownFlags } from "../command-builder";
import { formatCompletenessOutput } from "../completeness-output";
import { runCommand } from "../error-boundary";
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
import { matchIdForPlayerStatsSource, resolveMatchId } from "../match-resolver";
import { validateStatsMode } from "../mode-validation";
import { resolveTeamNameOrPrompt } from "../resolvers";
import { applyStatsFilters, filterTeamStats } from "../stats-filters";
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
  run: runCommand<typeof STATS_ARGS>((args) =>
    Effect.gen(function* () {
      yield* Effect.fromResult(rejectUnknownFlags(STATS_ARGS, process.argv));
      const season = yield* Effect.fromResult(validateSeason(args.season));
      const round = args.round ? yield* Effect.fromResult(validateRound(args.round)) : undefined;
      const competition = yield* Effect.fromResult(validateCompetition(args.competition));
      const format = yield* Effect.fromResult(validateFormat(args.format));
      const groupBy = yield* Effect.fromResult(validateGroupBy(args.by));

      yield* Effect.fromResult(
        validateStatsMode({
          groupBy,
          round,
          match: args.match,
          matchId: args.id,
          player: args.player,
          summary: args.summary,
        }),
      );

      const registry = yield* SourceRegistry;

      if (groupBy === "team") {
        const source = args.source
          ? yield* Effect.fromResult(validateSource(args.source))
          : registry.teamStats.defaultSource;

        const summaryType = args.summary
          ? yield* Effect.fromResult(validateSummary(args.summary))
          : undefined;

        const team = args.team ? yield* resolveTeamNameOrPrompt(args.team) : undefined;

        const stats = yield* withSpinner(
          "Fetching team stats…",
          fetchTeamStats({
            source,
            season,
            competition,
            ...(summaryType !== undefined && { summaryType }),
          }),
        );

        const data = filterTeamStats(stats, team);

        const missingGamesPlayed = data
          .filter((entry) => entry.gamesPlayed === null)
          .map((entry) => entry.team);

        if (missingGamesPlayed.length > 0) {
          console.error(
            pc.yellow(
              `Warning: games played is unavailable for ${missingGamesPlayed.join(", ")}; totals are returned with a null denominator.`,
            ),
          );
        }

        showSummary(
          `Loaded stats for ${data.length} teams (${season}${summaryType ? `, ${summaryType}` : ""})`,
        );

        const formatOptions: FormatOptions = {
          json: args.json,
          csv: args.csv,
          format,
          full: args.full,
          columns: TEAM_COLUMNS,
        };

        console.log(formatOutput(data, formatOptions));

        return;
      }

      const source = args.source
        ? yield* Effect.fromResult(validateSource(args.source))
        : registry.playerStats.defaultSource;

      const teamFilter = args.team ? yield* resolveTeamNameOrPrompt(args.team) : undefined;

      const matchResolution = yield* resolveMatchId({
        matchIdArg: args.id,
        matchArg: args.match,
        source,
        competition,
        season,
        round,
      });

      const result = yield* withSpinner(
        "Fetching player stats…",
        fetchPlayerStats({
          source,
          season,
          round,
          matchId: matchIdForPlayerStatsSource(source, matchResolution),
          competition,
        }),
      );

      // Season scrapes can lose individual games — warn (on stderr, so JSON/CSV
      // stdout output stays clean) rather than silently presenting a partial
      // season as complete.
      const { failedMatchIds } = result;

      if (failedMatchIds.length > 0) {
        console.error(
          pc.yellow(
            `Warning: ${failedMatchIds.length} game(s) failed to fetch and are missing from the results: ${failedMatchIds.join(", ")}`,
          ),
        );
      }

      const data = applyStatsFilters(result.stats, {
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

      console.log(formatCompletenessOutput({ stats: data, failedMatchIds }, data, formatOptions));
    }),
  ),
});
