/**
 * `ladder` command — season standings.
 *
 * Bypasses `defineFitzroyCommand` because the JSON output preserves the
 * full `Ladder` envelope (`season`, `roundNumber`, `competition`,
 * `entries`) while table/CSV output flattens to `entries[]`. The shared
 * builder only supports flat-array results. (#101)
 */

import { defineCommand } from "citty";
import { Effect } from "effect";
import { fetchLadder } from "../../index";
import { rejectUnknownFlags } from "../command-builder";
import { runCommand } from "../error-boundary";
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
  run: runCommand<typeof LADDER_ARGS>((args) =>
    Effect.gen(function* () {
      yield* Effect.fromResult(rejectUnknownFlags(LADDER_ARGS, process.argv));
      const season = yield* Effect.fromResult(validateSeason(args.season));
      const round = args.round ? yield* Effect.fromResult(validateRound(args.round)) : undefined;
      const source = yield* Effect.fromResult(validateSource(args.source));
      const competition = yield* Effect.fromResult(validateCompetition(args.competition));
      const format = yield* Effect.fromResult(validateFormat(args.format));

      const ladder = yield* withSpinner(
        "Fetching ladder…",
        fetchLadder({ source, season, round, competition }),
      );

      showSummary(
        `Loaded ladder for ${season}${round ? ` round ${round}` : ""} (${ladder.entries.length} teams)`,
      );

      const formatOptions: FormatOptions = {
        json: args.json,
        csv: args.csv,
        format,
        full: args.full,
        columns: DEFAULT_COLUMNS,
      };

      const resolved = resolveFormat(formatOptions);
      console.log(
        resolved === "json" ? formatJson(ladder) : formatOutput(ladder.entries, formatOptions),
      );
    }),
  ),
});
