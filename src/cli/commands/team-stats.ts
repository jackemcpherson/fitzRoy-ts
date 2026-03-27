import { defineCommand } from "citty";
import { fetchTeamStats } from "../../index";
import type { TeamStatsSummaryType } from "../../types";
import { withErrorBoundary } from "../error-boundary";
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
 * Normalise AFL Tables stat keys to canonical short keys matching FootyWire convention.
 *
 * AFL Tables uses suffixed keys like `KI_for`, `MK_for`, etc.
 * FootyWire uses short keys like `K`, `HB`, `D`, etc.
 */
const AFL_TABLES_KEY_MAP: Readonly<Record<string, string>> = {
  KI_for: "K",
  MK_for: "M",
  HB_for: "HB",
  DI_for: "D",
  GL_for: "G",
  BH_for: "B",
  HO_for: "HO",
  TK_for: "T",
  RB_for: "RB",
  IF_for: "IF",
  CL_for: "CL",
  CG_for: "CG",
  FF_for: "FF",
  BR_for: "BR",
  CP_for: "CP",
  UP_for: "UP",
  CM_for: "CM",
  MI_for: "MI",
  "1%_for": "1%",
  BO_for: "BO",
  GA_for: "GA",
  I50_for: "I50",
  // "against" variants
  KI_against: "K_against",
  MK_against: "M_against",
  HB_against: "HB_against",
  DI_against: "D_against",
  GL_against: "G_against",
  BH_against: "B_against",
  HO_against: "HO_against",
  TK_against: "T_against",
  RB_against: "RB_against",
  IF_against: "IF_against",
  CL_against: "CL_against",
  CG_against: "CG_against",
  FF_against: "FF_against",
  BR_against: "BR_against",
  CP_against: "CP_against",
  UP_against: "UP_against",
  CM_against: "CM_against",
  MI_against: "MI_against",
  "1%_against": "1%_against",
  BO_against: "BO_against",
  GA_against: "GA_against",
  I50_against: "I50_against",
};

/**
 * Flatten TeamStatsEntry for tabular output.
 *
 * Lifts stats record keys to top-level so they appear as columns.
 * Normalises AFL Tables keys to the canonical short form.
 */
function flattenEntries(
  data: readonly { team: string; gamesPlayed: number; stats: Readonly<Record<string, number>> }[],
): Record<string, unknown>[] {
  return data.map((entry) => {
    const { stats, ...rest } = entry;
    const normalised: Record<string, number> = {};
    for (const [key, value] of Object.entries(stats)) {
      normalised[AFL_TABLES_KEY_MAP[key] ?? key] = value;
    }
    return { ...rest, ...normalised };
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
  run: withErrorBoundary(async ({ args }) => {
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
  }),
});
