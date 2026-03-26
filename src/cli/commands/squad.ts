import { defineCommand } from "citty";
import { fetchSquad } from "../../index";
import type { CompetitionCode } from "../../types";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "displayName", label: "Player", maxWidth: 24 },
  { key: "jumperNumber", label: "#", maxWidth: 4 },
  { key: "position", label: "Pos", maxWidth: 12 },
  { key: "heightCm", label: "Ht", maxWidth: 5 },
  { key: "weightKg", label: "Wt", maxWidth: 5 },
];

export const squadCommand = defineCommand({
  meta: {
    name: "squad",
    description: "Fetch team squad for a season",
  },
  args: {
    "team-id": { type: "string", description: "Team ID", required: true },
    season: { type: "string", description: "Season year (e.g. 2025)", required: true },
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
    const teamId = args["team-id"];
    const season = Number(args.season);

    const result = await withSpinner("Fetching squad…", () =>
      fetchSquad({
        teamId,
        season,
        competition: args.competition as CompetitionCode,
      }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.players.length} players for ${data.teamName} ${season}`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format: args.format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data.players as unknown as Record<string, unknown>[], formatOptions));
  },
});
