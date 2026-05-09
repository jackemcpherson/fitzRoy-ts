/**
 * `ladder` command — season standings.
 *
 * Bypasses `defineFitzroyCommand` because the JSON output preserves the
 * full `Ladder` envelope (`season`, `roundNumber`, `competition`,
 * `entries`) while table/CSV output flattens to `entries[]`. The shared
 * builder only supports flat-array results. (#101)
 */

import { defineCommand } from "citty";
import { fetchLadder } from "../../index";
import { rejectUnknownFlags } from "../command-builder";
import { withErrorBoundary } from "../error-boundary";
import { COMPETITION_FLAG, OUTPUT_FLAGS, ROUND_FLAG, SEASON_FLAG, SOURCE_FLAG } from "../flags";
import {
  type FormatOptions,
  formatJson,
  formatOutput,
  resolveFormat,
  type TableColumnConfig,
} from "../formatters/index";
import { showSummary, withSpinner } from "../ui";
import {
  validateCompetition,
  validateFormat,
  validateRound,
  validateSeason,
  validateSource,
} from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "position", label: "Pos", maxWidth: 4 },
  { key: "team", label: "Team", maxWidth: 24 },
  { key: "wins", label: "W", maxWidth: 4 },
  { key: "losses", label: "L", maxWidth: 4 },
  { key: "draws", label: "D", maxWidth: 4 },
  { key: "percentage", label: "Pct", maxWidth: 8 },
  { key: "premiershipsPoints", label: "Pts", maxWidth: 5 },
];

const LADDER_ARGS = {
  ...SEASON_FLAG,
  ...ROUND_FLAG,
  ...SOURCE_FLAG,
  ...COMPETITION_FLAG,
  ...OUTPUT_FLAGS,
} as const;

export const ladderCommand = defineCommand({
  meta: {
    name: "ladder",
    description: "Fetch ladder standings for a season",
  },
  args: LADDER_ARGS,
  run: withErrorBoundary(async ({ args }) => {
    rejectUnknownFlags(LADDER_ARGS, process.argv);
    const season = validateSeason(args.season as string);
    const round = args.round ? validateRound(args.round as string) : undefined;
    const source = validateSource(args.source as string);
    const competition = validateCompetition(args.competition as string);
    const format = validateFormat(args.format as string | undefined);

    const result = await withSpinner("Fetching ladder…", () =>
      fetchLadder({ source, season, round, competition }),
    );
    if (!result.success) throw result.error;

    const ladder = result.data;
    showSummary(
      `Loaded ladder for ${season}${round ? ` round ${round}` : ""} (${ladder.entries.length} teams)`,
    );

    const formatOptions: FormatOptions = {
      json: args.json as boolean | undefined,
      csv: args.csv as boolean | undefined,
      format,
      full: args.full as boolean | undefined,
      columns: DEFAULT_COLUMNS,
    };
    const resolved = resolveFormat(formatOptions);
    console.log(
      resolved === "json"
        ? formatJson(ladder)
        : formatOutput(ladder.entries as readonly object[], formatOptions),
    );
  }),
});
