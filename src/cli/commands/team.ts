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
import type { Lineup } from "../../types";
import { withErrorBoundary } from "../error-boundary";
import { COMPETITION_FLAG, OUTPUT_FLAGS, ROUND_FLAG, SOURCE_FLAG, TEAM_FLAG } from "../flags";
import {
  type FormatOptions,
  formatOutput,
  resolveFormat,
  type TableColumnConfig,
} from "../formatters/index";
import { resolveMatchId } from "../match-resolver";
import { resolveTeamNameOrPrompt } from "../resolvers";
import { showSummary, withSpinner } from "../ui";
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
  { key: "position", label: "Pos", maxWidth: 12 },
];

function flattenLineups(lineups: readonly Lineup[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const lineup of lineups) {
    for (const { players, team } of [
      { players: lineup.homePlayers, team: lineup.homeTeam },
      { players: lineup.awayPlayers, team: lineup.awayTeam },
    ]) {
      for (const p of players) {
        rows.push({
          matchId: lineup.matchId,
          team,
          displayName: p.displayName,
          jumperNumber: p.jumperNumber,
          position: p.position,
          isEmergency: p.isEmergency,
          isSubstitute: p.isSubstitute,
        });
      }
    }
  }
  return rows;
}

export const teamCommand = defineCommand({
  meta: {
    name: "team",
    description: "Team identity. Add -s for the season squad, -s -r for the match-day lineup.",
  },
  args: {
    name: { type: "string", description: "Team name (required for squad/lineup zoom)" },
    season: { type: "string", description: "Season year (e.g. 2025)", alias: "s" },
    ...ROUND_FLAG,
    match: { type: "string", description: "Filter lineups to a specific match (team name)" },
    "match-id": { type: "string", description: "Specific match provider ID (advanced)" },
    ...SOURCE_FLAG,
    ...COMPETITION_FLAG,
    ...TEAM_FLAG,
    ...OUTPUT_FLAGS,
  },
  run: withErrorBoundary(async ({ args }) => {
    const season = validateOptionalSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    // Dispatch by flag presence
    if (season != null && round != null) {
      // Lineup mode
      const matchId = await resolveMatchId({
        matchIdArg: args["match-id"],
        matchArg: args.match,
        competition,
        season,
        round,
      });

      const result = await withSpinner("Fetching lineups…", () =>
        fetchLineup({ source, season, round, matchId, competition }),
      );
      if (!result.success) throw result.error;

      const teamName = args.name || args.team;
      const data = teamName
        ? result.data.filter((l) => l.homeTeam === teamName || l.awayTeam === teamName)
        : result.data;
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
      const resolvedFormat = resolveFormat(formatOptions);
      console.log(
        resolvedFormat === "json"
          ? formatOutput(data, formatOptions)
          : formatOutput(flattenLineups(data), formatOptions),
      );
      return;
    }

    const teamName = args.name || args.team;
    if (season != null && teamName) {
      // Squad mode
      const team = await resolveTeamNameOrPrompt(teamName);

      const result = await withSpinner("Fetching squad…", () =>
        fetchSquad({ team, season, competition }),
      );
      if (!result.success) throw result.error;

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
      console.log(formatOutput(result.data.players, formatOptions));
      return;
    }

    // Default: list teams
    const result = await withSpinner("Fetching teams…", () => fetchTeams({ competition }));
    if (!result.success) throw result.error;
    showSummary(`Loaded ${result.data.length} teams`);
    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: TEAMS_COLUMNS,
    };
    console.log(formatOutput(result.data, formatOptions));
  }),
});
