import { defineCommand } from "citty";
import { fetchPlayerDetails } from "../../index";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";
import {
  resolveDefaultSeason,
  validateCompetition,
  validateFormat,
  validateOptionalSeason,
  validateSource,
} from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "displayName", label: "Player", maxWidth: 24 },
  { key: "jumperNumber", label: "#", maxWidth: 4 },
  { key: "position", label: "Pos", maxWidth: 12 },
  { key: "heightCm", label: "Ht", maxWidth: 5 },
  { key: "weightKg", label: "Wt", maxWidth: 5 },
  { key: "gamesPlayed", label: "Games", maxWidth: 6 },
  { key: "dateOfBirth", label: "DOB", maxWidth: 12 },
];

export const playerDetailsCommand = defineCommand({
  meta: {
    name: "player-details",
    description: "Fetch player biographical details for a team",
  },
  args: {
    team: { type: "positional", description: "Team name (e.g. Carlton, Hawthorn)", required: true },
    source: {
      type: "string",
      description: "Data source: afl-api, footywire, afl-tables",
      default: "afl-api",
    },
    season: { type: "string", description: "Season year (for AFL API source, e.g. 2025)" },
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
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);
    const season = validateOptionalSeason(args.season) ?? resolveDefaultSeason(competition);

    const result = await withSpinner("Fetching player details…", () =>
      fetchPlayerDetails({ source, team: args.team, season, competition }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.length} players for ${args.team} (${source})`);

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
