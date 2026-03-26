import { defineCommand } from "citty";
import { fetchPlayerStats } from "../../index";
import type { CompetitionCode, DataSource } from "../../types";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "displayName", label: "Player", maxWidth: 22 },
  { key: "team", label: "Team", maxWidth: 18 },
  { key: "disposals", label: "Disp", maxWidth: 6 },
  { key: "kicks", label: "Kicks", maxWidth: 6 },
  { key: "handballs", label: "HB", maxWidth: 6 },
  { key: "marks", label: "Marks", maxWidth: 6 },
  { key: "goals", label: "Goals", maxWidth: 6 },
];

export const statsCommand = defineCommand({
  meta: {
    name: "stats",
    description: "Fetch player statistics for a season",
  },
  args: {
    season: { type: "string", description: "Season year (e.g. 2025)", required: true },
    round: { type: "string", description: "Round number" },
    "match-id": { type: "string", description: "Specific match ID" },
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
    const matchId = args["match-id"];

    const result = await withSpinner("Fetching player stats…", () =>
      fetchPlayerStats({
        source: args.source as DataSource,
        season,
        round,
        matchId,
        competition: args.competition as CompetitionCode,
      }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(
      `Loaded ${data.length} player stat lines for ${season}${round ? ` round ${round}` : ""}`,
    );

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
