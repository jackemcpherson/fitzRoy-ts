/**
 * `player` command — biographical lookup for players.
 *
 * Replaces the old `player-details` command. Default behaviour mirrors the
 * old command: optional `--team` filter, season defaults to the current
 * in-progress (else most recently completed) season via
 * `resolveDefaultSeasonForCompetition`. Future enhancement: add per-player
 * season summary.
 */

import { defineCommand } from "citty";
import { fetchPlayerDetails, resolveDefaultSeasonForCompetition } from "../../index";
import { rejectUnknownFlags } from "../command-builder";
import { formatCompletenessOutput } from "../completeness-output";
import { withErrorBoundary } from "../error-boundary";
import {
  COMPETITION_FLAG,
  OPTIONAL_SEASON_FLAG,
  OUTPUT_FLAGS,
  SOURCE_FLAG,
  TEAM_FLAG,
} from "../flags";
import type { FormatOptions, TableColumnConfig } from "../formatters/index";
import { resolveTeamNameOrPrompt } from "../resolvers";
import { showSummary, showWarning, withSpinner } from "../ui";
import {
  validateCompetition,
  validateFormat,
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

const PLAYER_ARGS = {
  ...TEAM_FLAG,
  ...SOURCE_FLAG,
  ...OPTIONAL_SEASON_FLAG,
  ...COMPETITION_FLAG,
  ...OUTPUT_FLAGS,
} as const;

export const playerCommand = defineCommand({
  meta: {
    name: "player",
    description: "Fetch player biographical details (optionally filtered by team)",
  },
  args: PLAYER_ARGS,
  run: withErrorBoundary(async ({ args }) => {
    rejectUnknownFlags(PLAYER_ARGS, process.argv);
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const explicit = validateOptionalSeason(args.season);
    const team = args.team ? await resolveTeamNameOrPrompt(args.team) : undefined;
    const season = explicit ?? (await resolveDefaultSeasonForCompetition(competition));
    const format = validateFormat(args.format);

    const result = await withSpinner("Fetching player details…", () =>
      fetchPlayerDetails({ source, team, season, competition }),
    );
    if (!result.success) throw result.error;

    const { players, failedTeams, scope } = result.data;
    if (failedTeams.length > 0) {
      showWarning(
        `${failedTeams.length} team squad request(s) failed and are missing: ${failedTeams.join(", ")}`,
      );
    }
    if (scope === "all-time") {
      showWarning(
        `--source ${source} returns all-time player data. The requested season ${season} is query context and does not narrow the player list.`,
      );
    }
    showSummary(
      team
        ? `Loaded ${players.length} players for ${team} (${source})`
        : `Loaded ${players.length} players across all teams (${source})`,
    );

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };
    console.log(formatCompletenessOutput(result.data, players as readonly object[], formatOptions));
  }),
});
