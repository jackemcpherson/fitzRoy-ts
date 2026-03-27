import { defineCommand } from "citty";
import { fetchSquad, fetchTeams } from "../../index";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { showSummary, withSpinner } from "../ui";
import {
  resolveTeamIdentifier,
  validateCompetition,
  validateFormat,
  validateSeason,
} from "../validation";

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
    "team-id": {
      type: "string",
      description: "Team ID, abbreviation, or name (e.g. 5, CARL, Carlton)",
      required: true,
    },
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
    const season = validateSeason(args.season);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    // Skip teams lookup if already a numeric ID
    let teamId = args["team-id"].trim();
    const isNumeric = /^\d+$/.test(teamId);
    if (!isNumeric) {
      const teamsResult = await withSpinner("Resolving team…", () => fetchTeams({ competition }));
      if (!teamsResult.success) {
        throw teamsResult.error;
      }
      teamId = resolveTeamIdentifier(args["team-id"], teamsResult.data);
    }

    const result = await withSpinner("Fetching squad…", () =>
      fetchSquad({ teamId, season, competition }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.players.length} players for ${data.teamName} ${season}`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data.players, formatOptions));
  },
});
