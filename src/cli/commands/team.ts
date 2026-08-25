/**
 * `team` command — team identity with temporal zoom.
 *
 * Dispatches by flag presence:
 *   - no -s, no -r → fetchTeams (list of teams)
 *   - --name X -s S → fetchSquad (the team's roster for that season)
 *   - -s S -r R [--name X] → fetchLineup (match-day team sheets)
 *
 * One CLI verb covers what was previously three commands (teams, squad, lineup).
 */

import { defineCommand } from "citty";
import { fetchLineup, fetchSquad, fetchTeams } from "../../index";
import type { TeamResponse } from "../../types";
import { rejectUnknownFlags } from "../command-builder";
import { withErrorBoundary } from "../error-boundary";
import { COMPETITION_FLAG, OUTPUT_FLAGS, ROUND_FLAG, SOURCE_FLAG, TEAM_FLAG } from "../flags";
import {
  type FormatOptions,
  formatJson,
  formatOutput,
  resolveFormat,
  type TableColumnConfig,
} from "../formatters/index";
import { resolveMatchId } from "../match-resolver";
import { validateTeamMode } from "../mode-validation";
import { resolveTeamNameOrPrompt } from "../resolvers";
import { filterLineupsByTeam, filterTeamList, flattenLineups } from "../team-filters";
import { showSummary, showWarning, withSpinner } from "../ui";
import {
  validateCompetition,
  validateFormat,
  validateOptionalSeason,
  validateRound,
  validateSource,
} from "../validation";

const TEAMS_COLUMNS: TableColumnConfig[] = [
  { key: "teamId", label: "ID", maxWidth: 8 },
  { key: "name", label: "Team", maxWidth: 24 },
  { key: "abbreviation", label: "Abbr", maxWidth: 6 },
  { key: "competition", label: "Comp", maxWidth: 6 },
];

const SQUAD_COLUMNS: TableColumnConfig[] = [
  { key: "displayName", label: "Player", maxWidth: 24 },
  { key: "jumperNumber", label: "#", maxWidth: 4 },
  { key: "position", label: "Pos", maxWidth: 12 },
  { key: "heightCm", label: "Ht", maxWidth: 5 },
  { key: "weightKg", label: "Wt", maxWidth: 5 },
];

const LINEUP_COLUMNS: TableColumnConfig[] = [
  { key: "matchId", label: "Match", maxWidth: 14 },
  { key: "team", label: "Team", maxWidth: 20 },
  { key: "displayName", label: "Player", maxWidth: 24 },
  { key: "jumperNumber", label: "#", maxWidth: 4 },
  { key: "matchPosition", label: "Pos", maxWidth: 12 },
];

function printTeamResponse(
  jsonPayload: TeamResponse,
  tableData: readonly object[],
  formatOptions: FormatOptions,
): void {
  const resolvedFormat = resolveFormat(formatOptions);
  console.log(
    resolvedFormat === "json" ? formatJson(jsonPayload) : formatOutput(tableData, formatOptions),
  );
}

const TEAM_ARGS = {
  name: { type: "string", description: "Team name (required for squad/lineup zoom)" },
  season: { type: "string", description: "Season year (e.g. 2025)", alias: "s" },
  ...ROUND_FLAG,
  match: { type: "string", description: "Filter lineups to a specific match (team name)" },
  "match-id": { type: "string", description: "Specific match provider ID (advanced)" },
  ...SOURCE_FLAG,
  ...COMPETITION_FLAG,
  ...TEAM_FLAG,
  ...OUTPUT_FLAGS,
} as const;

export const teamCommand = defineCommand({
  meta: {
    name: "team",
    description: "Team identity. Add -s for the season squad, -s -r for the match-day lineup.",
  },
  args: TEAM_ARGS,
  run: withErrorBoundary(async ({ args }) => {
    rejectUnknownFlags(TEAM_ARGS, process.argv);
    const season = validateOptionalSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);
    const mode = validateTeamMode({
      season,
      round,
      name: args.name,
      team: args.team,
      match: args.match,
      matchId: args["match-id"],
    });

    // Dispatch by flag presence
    if (mode === "lineup" && season != null && round != null) {
      // Lineup mode
      const teamInput = args.name ?? args.team;
      const teamName = teamInput
        ? await resolveTeamNameOrPrompt(
            teamInput,
            competition === "AFLM" || competition === "AFLW" ? undefined : [],
          )
        : undefined;
      const matchResolution = await resolveMatchId({
        matchIdArg: args["match-id"],
        matchArg: args.match,
        source,
        competition,
        season,
        round,
      });

      const result = await withSpinner("Fetching lineups…", () =>
        fetchLineup({
          source,
          season,
          round,
          matchId: matchResolution?.matchId,
          competition,
        }),
      );
      if (!result.success) throw result.error;

      const data = teamName ? filterLineupsByTeam(result.data, teamName) : result.data;
      showSummary(
        `Loaded ${data.length} lineup${data.length === 1 ? "" : "s"} for ${season} round ${round}${teamName ? ` (${teamName})` : ""}`,
      );

      const formatOptions: FormatOptions = {
        json: args.json,
        csv: args.csv,
        format,
        full: args.full,
        columns: LINEUP_COLUMNS,
      };
      printTeamResponse(
        { mode: "lineup", lineups: data },
        flattenLineups(data, teamName ?? undefined),
        formatOptions,
      );
      return;
    }

    const teamName = args.name || args.team;
    if (mode === "squad" && season != null && teamName) {
      // Squad mode. For VFL/VFLW, skip the AFLM-senior allow-list — those
      // competitions include standalone clubs (Box Hill, Sandringham, …)
      // that the adapter resolves against the per-competition team list
      // (#81).
      const isAfl = competition === "AFLM" || competition === "AFLW";
      const team = isAfl
        ? await resolveTeamNameOrPrompt(teamName)
        : await resolveTeamNameOrPrompt(teamName, []);

      const result = await withSpinner("Fetching squad…", () =>
        fetchSquad({ source, team, season, competition }),
      );
      if (!result.success) throw result.error;
      if (result.data.scope === "all-time") {
        showWarning(
          `--source ${source} returns an all-time roster. The requested --season ${season} is query context and does not narrow the player list.`,
        );
      }

      showSummary(
        `Loaded ${result.data.players.length} players for ${result.data.teamName} ${season}`,
      );
      const formatOptions: FormatOptions = {
        json: args.json,
        csv: args.csv,
        format,
        full: args.full,
        columns: SQUAD_COLUMNS,
      };
      printTeamResponse({ mode: "squad", squad: result.data }, result.data.players, formatOptions);
      return;
    }

    // Default: list teams
    if (source !== "afl-api") {
      throw new Error(
        `--source ${source} is not supported for the team list. The team list is only available from afl-api; add --season (and --name) for squad mode, or --season --round for lineup mode, where other sources apply.`,
      );
    }

    const result = await withSpinner("Fetching teams…", () => fetchTeams({ competition }));
    if (!result.success) throw result.error;

    const filterName = args.name || args.team;
    const data = filterName ? filterTeamList(result.data, filterName) : result.data;

    showSummary(`Loaded ${data.length} team${data.length === 1 ? "" : "s"}`);
    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: TEAMS_COLUMNS,
    };
    printTeamResponse({ mode: "list", teams: data }, data, formatOptions);
  }),
});
