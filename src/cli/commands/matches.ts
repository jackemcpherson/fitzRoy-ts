import { defineCommand } from "citty";
import { fetchMatchResults } from "../../index";
import { withErrorBoundary } from "../error-boundary";
import { COMPETITION_FLAG, OUTPUT_FLAGS, ROUND_FLAG, SEASON_FLAG, SOURCE_FLAG } from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";
import {
  validateCompetition,
  validateFormat,
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

export const matchesCommand = defineCommand({
  meta: {
    name: "matches",
    description: "Fetch match results for a season",
  },
  args: {
    ...SEASON_FLAG,
    ...ROUND_FLAG,
    ...SOURCE_FLAG,
    ...COMPETITION_FLAG,
    ...OUTPUT_FLAGS,
  },
  run: withErrorBoundary(async ({ args }) => {
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    const result = await withSpinner("Fetching match results…", () =>
      fetchMatchResults({ source, season, round, competition }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.length} matches for ${season}${round ? ` round ${round}` : ""}`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data, formatOptions));
  }),
});
