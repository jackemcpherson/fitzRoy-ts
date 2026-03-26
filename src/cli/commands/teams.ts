import { defineCommand } from "citty";
import { fetchTeams } from "../../index";
import type { CompetitionCode } from "../../types";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "teamId", label: "ID", maxWidth: 8 },
  { key: "name", label: "Team", maxWidth: 24 },
  { key: "abbreviation", label: "Abbr", maxWidth: 6 },
  { key: "competition", label: "Comp", maxWidth: 6 },
];

export const teamsCommand = defineCommand({
  meta: {
    name: "teams",
    description: "Fetch team list",
  },
  args: {
    competition: { type: "string", description: "Competition code (AFLM or AFLW)" },
    "team-type": { type: "string", description: "Team type filter" },
    json: { type: "boolean", description: "Output as JSON" },
    csv: { type: "boolean", description: "Output as CSV" },
    format: { type: "string", description: "Output format: table, json, csv" },
    full: { type: "boolean", description: "Show all columns in table output" },
  },
  async run({ args }) {
    const result = await withSpinner("Fetching teams…", () =>
      fetchTeams({
        competition: args.competition as CompetitionCode | undefined,
        teamType: args["team-type"],
      }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.length} teams`);

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
