import { defineCommand } from "citty";
import { fetchMatchResults } from "../../index";
import type { CompetitionCode, DataSource } from "../../types";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";

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
    const season = Number(args.season);
    const round = args.round ? Number(args.round) : undefined;

    const result = await withSpinner("Fetching match results…", () =>
      fetchMatchResults({
        source: args.source as DataSource,
        season,
        round,
        competition: args.competition as CompetitionCode,
      }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.length} matches for ${season}${round ? ` round ${round}` : ""}`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format: args.format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data, formatOptions));
  },
});
