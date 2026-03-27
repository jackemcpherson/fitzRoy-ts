import { defineCommand } from "citty";
import { fetchLadder } from "../../index";
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
  { key: "position", label: "Pos", maxWidth: 4 },
  { key: "team", label: "Team", maxWidth: 24 },
  { key: "wins", label: "W", maxWidth: 4 },
  { key: "losses", label: "L", maxWidth: 4 },
  { key: "draws", label: "D", maxWidth: 4 },
  { key: "percentage", label: "Pct", maxWidth: 8 },
  { key: "premiershipsPoints", label: "Pts", maxWidth: 5 },
];

export const ladderCommand = defineCommand({
  meta: {
    name: "ladder",
    description: "Fetch ladder standings for a season",
  },
  args: {
    season: { type: "string", description: "Season year (e.g. 2025)", required: true },
    round: { type: "string", description: "Round number" },
    source: { type: "string", description: "Data source", default: "afl-api" },
    competition: {
      type: "string",
      description: "Competition code (AFLM or AFLW)",
      default: "AFLM",
    },
    json: { type: "boolean", description: "Output as JSON" },
    csv: { type: "boolean", description: "Output as CSV" },
    format: { type: "string", description: "Output format: table, json, csv" },
    full: { type: "boolean", description: "Show all columns in table output" },
  },
  async run({ args }) {
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    const result = await withSpinner("Fetching ladder…", () =>
      fetchLadder({ source, season, round, competition }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(
      `Loaded ladder for ${season}${round ? ` round ${round}` : ""} (${data.entries.length} teams)`,
    );

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data.entries, formatOptions));
  },
});
