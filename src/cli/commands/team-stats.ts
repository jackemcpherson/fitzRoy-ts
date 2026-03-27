import { defineCommand } from "citty";
import { fetchTeamStats } from "../../index";
import type { TeamStatsSummaryType } from "../../types";
import { OUTPUT_FLAGS, SEASON_FLAG } from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";
import { validateFormat, validateSeason, validateSource } from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "team", label: "Team", maxWidth: 24 },
  { key: "gamesPlayed", label: "GP", maxWidth: 5 },
  { key: "K", label: "K", maxWidth: 6 },
  { key: "HB", label: "HB", maxWidth: 6 },
  { key: "D", label: "D", maxWidth: 6 },
  { key: "M", label: "M", maxWidth: 6 },
  { key: "G", label: "G", maxWidth: 6 },
  { key: "B", label: "B", maxWidth: 6 },
  { key: "T", label: "T", maxWidth: 6 },
  { key: "I50", label: "I50", maxWidth: 6 },
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
    ...SEASON_FLAG,
    source: {
      type: "string",
      description: "Data source (footywire, afl-tables)",
      default: "footywire",
    },
    summary: { type: "string", description: "Summary type: totals or averages", default: "totals" },
    ...OUTPUT_FLAGS,
  },
  async run({ args }) {
    const season = validateSeason(args.season);
    const source = validateSource(args.source);
    const format = validateFormat(args.format);
    const summaryType = args.summary as TeamStatsSummaryType;

    const result = await withSpinner("Fetching team stats\u2026", () =>
      fetchTeamStats({ source, season, summaryType }),
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
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(flat, formatOptions));
  },
});
