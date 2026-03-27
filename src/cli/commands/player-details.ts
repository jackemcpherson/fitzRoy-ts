import { defineCommand } from "citty";
import { fetchPlayerDetails } from "../../index";
import { withErrorBoundary } from "../error-boundary";
import { COMPETITION_FLAG, OPTIONAL_SEASON_FLAG, OUTPUT_FLAGS, REQUIRED_TEAM_FLAG } from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { resolveTeamNameOrPrompt } from "../resolvers";
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
    ...REQUIRED_TEAM_FLAG,
    source: {
      type: "string",
      description: "Data source: afl-api, footywire, afl-tables",
      default: "afl-api",
    },
    ...OPTIONAL_SEASON_FLAG,
    ...COMPETITION_FLAG,
    ...OUTPUT_FLAGS,
  },
  run: withErrorBoundary(async ({ args }) => {
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);
    const season = validateOptionalSeason(args.season) ?? resolveDefaultSeason(competition);
    const team = await resolveTeamNameOrPrompt(args.team);

    const result = await withSpinner("Fetching player details…", () =>
      fetchPlayerDetails({ source, team, season, competition }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.length} players for ${team} (${source})`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    console.log(formatOutput(data, formatOptions));
  }),
});
