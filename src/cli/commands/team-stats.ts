import { defineCommand } from "citty";
import { fetchTeamStats } from "../../index";
import type { DataSource, TeamStatsSummaryType } from "../../types";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "team", label: "Team", maxWidth: 24 },
  { key: "gamesPlayed", label: "GP", maxWidth: 5 },
];

/**
 * Flatten TeamStatsEntry for tabular output.
 *
 * Lifts stats record keys to top-level so they appear as columns.
 */
function flattenEntries(
  data: readonly { team: string; gamesPlayed: number; stats: Readonly<Record<string, number>> }[],
): Record<string, unknown>[] {
  return data.map((entry) => {
    const { stats, ...rest } = entry;
    return { ...rest, ...stats };
  });
}

export const teamStatsCommand = defineCommand({
  meta: {
    name: "team-stats",
    description: "Fetch team aggregate statistics for a season",
  },
  args: {
    season: { type: "string", description: "Season year (e.g. 2024)", required: true },
    source: {
      type: "string",
      description: "Data source (footywire, afl-tables)",
      default: "footywire",
    },
    summary: { type: "string", description: "Summary type: totals or averages", default: "totals" },
    json: { type: "boolean", description: "Output as JSON" },
    csv: { type: "boolean", description: "Output as CSV" },
    format: { type: "string", description: "Output format: table, json, csv" },
    full: { type: "boolean", description: "Show all columns in table output" },
  },
  async run({ args }) {
    const season = Number(args.season);
    const summaryType = args.summary as TeamStatsSummaryType;

    const result = await withSpinner("Fetching team stats\u2026", () =>
      fetchTeamStats({
        source: args.source as DataSource,
        season,
        summaryType,
      }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded stats for ${data.length} teams (${season}, ${summaryType})`);

    const flat = flattenEntries(data);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format: args.format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(flat, formatOptions));
  },
});
