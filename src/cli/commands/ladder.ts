/**
 * `ladder` command — season standings.
 */

import { fetchLadder } from "../../index";
import { defineFitzroyCommand } from "../command-builder";
import { COMPETITION_FLAG, OUTPUT_FLAGS, ROUND_FLAG, SEASON_FLAG, SOURCE_FLAG } from "../flags";
import type { TableColumnConfig } from "../formatters/index";
import { validateCompetition, validateRound, validateSeason, validateSource } from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "position", label: "Pos", maxWidth: 4 },
  { key: "team", label: "Team", maxWidth: 24 },
  { key: "wins", label: "W", maxWidth: 4 },
  { key: "losses", label: "L", maxWidth: 4 },
  { key: "draws", label: "D", maxWidth: 4 },
  { key: "percentage", label: "Pct", maxWidth: 8 },
  { key: "premiershipsPoints", label: "Pts", maxWidth: 5 },
];

interface LadderArgs {
  season: string;
  round?: string;
  source: string;
  competition: string;
}

export const ladderCommand = defineFitzroyCommand<LadderArgs & Record<string, unknown>, object>({
  meta: {
    name: "ladder",
    description: "Fetch ladder standings for a season",
  },
  args: {
    ...SEASON_FLAG,
    ...ROUND_FLAG,
    ...SOURCE_FLAG,
    ...COMPETITION_FLAG,
    ...OUTPUT_FLAGS,
  },
  columns: DEFAULT_COLUMNS,
  spinner: "Fetching ladder…",
  run: async (args) => {
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);

    const result = await fetchLadder({ source, season, round, competition });
    if (!result.success) return result;
    // Surface the entries[] for tabular output.
    return { success: true, data: [...result.data.entries] };
  },
  summary: (data, args) =>
    `Loaded ladder for ${args.season}${args.round ? ` round ${args.round}` : ""} (${data.length} teams)`,
});
