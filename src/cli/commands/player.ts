/**
 * `player` command — biographical lookup for players.
 *
 * Replaces the old `player-details` command. Default behaviour mirrors the
 * old command: optional `--team` filter, season defaults to current via
 * `resolveDefaultSeason`. Future enhancement: add per-player season summary.
 */

import { fetchPlayerDetails } from "../../index";
import { defineFitzroyCommand } from "../command-builder";
import {
  COMPETITION_FLAG,
  OPTIONAL_SEASON_FLAG,
  OUTPUT_FLAGS,
  SOURCE_FLAG,
  TEAM_FLAG,
} from "../flags";
import type { TableColumnConfig } from "../formatters/index";
import { resolveTeamNameOrPrompt } from "../resolvers";
import {
  resolveDefaultSeason,
  validateCompetition,
  validateOptionalSeason,
  validateSource,
} from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "displayName", label: "Player", maxWidth: 24 },
  { key: "team", label: "Team", maxWidth: 18 },
  { key: "jumperNumber", label: "#", maxWidth: 4 },
  { key: "position", label: "Pos", maxWidth: 12 },
  { key: "heightCm", label: "Ht", maxWidth: 5 },
  { key: "weightKg", label: "Wt", maxWidth: 5 },
  { key: "gamesPlayed", label: "Games", maxWidth: 6 },
  { key: "dateOfBirth", label: "DOB", maxWidth: 12 },
];

interface PlayerArgs {
  source: string;
  season?: string;
  competition: string;
  team?: string;
}

export const playerCommand = defineFitzroyCommand<PlayerArgs & Record<string, unknown>, object>({
  meta: {
    name: "player",
    description: "Fetch player biographical details (optionally filtered by team)",
  },
  args: {
    ...TEAM_FLAG,
    ...SOURCE_FLAG,
    ...OPTIONAL_SEASON_FLAG,
    ...COMPETITION_FLAG,
    ...OUTPUT_FLAGS,
  },
  columns: DEFAULT_COLUMNS,
  spinner: "Fetching player details…",
  run: async (args) => {
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const season = validateOptionalSeason(args.season) ?? resolveDefaultSeason(competition);
    const team = args.team ? await resolveTeamNameOrPrompt(args.team) : undefined;

    return fetchPlayerDetails({ source, team, season, competition });
  },
  summary: (data, args) =>
    args.team
      ? `Loaded ${data.length} players for ${args.team} (${args.source})`
      : `Loaded ${data.length} players across all teams (${args.source})`,
});
