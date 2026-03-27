import { defineCommand } from "citty";
import { fetchFixture } from "../../index";
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
  { key: "roundNumber", label: "Round", maxWidth: 6 },
  { key: "date", label: "Date", maxWidth: 16 },
  { key: "homeTeam", label: "Home", maxWidth: 20 },
  { key: "awayTeam", label: "Away", maxWidth: 20 },
  { key: "venue", label: "Venue", maxWidth: 24 },
];

export const fixtureCommand = defineCommand({
  meta: {
    name: "fixture",
    description: "Fetch fixture/schedule for a season",
  },
  args: {
    ...SEASON_FLAG,
    ...ROUND_FLAG,
    ...SOURCE_FLAG,
    ...COMPETITION_FLAG,
    ...OUTPUT_FLAGS,
  },
  async run({ args }) {
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    const result = await withSpinner("Fetching fixture…", () =>
      fetchFixture({ source, season, round, competition }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.length} fixtures for ${season}${round ? ` round ${round}` : ""}`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data, formatOptions));
  },
});
