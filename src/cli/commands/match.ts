/**
 * `match` command — unified entry point for match data.
 *
 * Subsumes the old `matches` and `fixture` commands. Without --status,
 * returns all matches (any state). With --status Upcoming, behaves like
 * the old `fixture` command. With --status Complete, like the old
 * `matches` command.
 */

import { fetchMatches } from "../../index";
import { defineFitzroyCommand } from "../command-builder";
import {
  COMPETITION_FLAG,
  MATCH_ID_FLAG,
  OUTPUT_FLAGS,
  ROUND_FLAG,
  SEASON_FLAG,
  SOURCE_FLAG,
  STATUS_FLAG,
  TEAM_FLAG,
} from "../flags";
import type { TableColumnConfig } from "../formatters/index";
import { resolveTeamNameOrPrompt } from "../resolvers";
import {
  validateCompetition,
  validateMatchStatus,
  validateRound,
  validateSeason,
  validateSource,
} from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "date", label: "Date", maxWidth: 16 },
  { key: "roundNumber", label: "Round", maxWidth: 6 },
  { key: "homeTeam", label: "Home", maxWidth: 20 },
  { key: "awayTeam", label: "Away", maxWidth: 20 },
  { key: "homePoints", label: "H.Pts", maxWidth: 6 },
  { key: "awayPoints", label: "A.Pts", maxWidth: 6 },
  { key: "venue", label: "Venue", maxWidth: 24 },
];

interface MatchArgs {
  season: string;
  round?: string;
  source: string;
  competition: string;
  team?: string;
  status?: string;
  id?: string;
}

export const matchCommand = defineFitzroyCommand<MatchArgs & Record<string, unknown>, object>({
  meta: {
    name: "match",
    description: "Fetch matches (results, fixtures, or any combination via --status)",
  },
  args: {
    ...SEASON_FLAG,
    ...ROUND_FLAG,
    ...SOURCE_FLAG,
    ...COMPETITION_FLAG,
    ...TEAM_FLAG,
    ...STATUS_FLAG,
    ...MATCH_ID_FLAG,
    ...OUTPUT_FLAGS,
  },
  columns: DEFAULT_COLUMNS,
  spinner: "Fetching matches…",
  run: async (args) => {
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const status = args.status ? validateMatchStatus(args.status) : undefined;
    const team = args.team ? await resolveTeamNameOrPrompt(args.team) : undefined;

    return fetchMatches({
      source,
      season,
      round,
      matchId: args.id,
      team,
      status,
      competition,
    });
  },
  summary: (data, args) => {
    const filters: string[] = [String(args.season)];
    if (args.round) filters.push(`round ${args.round}`);
    if (args.status) filters.push(`status=${args.status}`);
    return `Loaded ${data.length} matches (${filters.join(", ")})`;
  },
});
