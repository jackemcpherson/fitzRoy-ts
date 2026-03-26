import { defineCommand } from "citty";
import { fetchLineup } from "../../index";
import type { CompetitionCode, DataSource } from "../../types";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "matchId", label: "Match", maxWidth: 12 },
  { key: "homeTeam", label: "Home", maxWidth: 20 },
  { key: "awayTeam", label: "Away", maxWidth: 20 },
];

export const lineupCommand = defineCommand({
  meta: {
    name: "lineup",
    description: "Fetch match lineups for a round",
  },
  args: {
    season: { type: "string", description: "Season year (e.g. 2025)", required: true },
    round: { type: "string", description: "Round number", required: true },
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
    const round = Number(args.round);
    const matchId = args["match-id"];

    const result = await withSpinner("Fetching lineups…", () =>
      fetchLineup({
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
    showSummary(`Loaded ${data.length} lineups for ${season} round ${round}`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format: args.format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data as unknown as Record<string, unknown>[], formatOptions));
  },
});
