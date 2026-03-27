import { defineCommand } from "citty";
import { fetchSquad, fetchTeams } from "../../index";
import { COMPETITION_FLAG, OUTPUT_FLAGS, REQUIRED_TEAM_FLAG, SEASON_FLAG } from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { resolveTeamOrPrompt } from "../resolvers";
import { showSummary, withSpinner } from "../ui";
import { validateCompetition, validateFormat, validateSeason } from "../validation";

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
    ...REQUIRED_TEAM_FLAG,
    ...SEASON_FLAG,
    ...COMPETITION_FLAG,
    ...OUTPUT_FLAGS,
  },
  async run({ args }) {
    const season = validateSeason(args.season);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    const teamsResult = await withSpinner("Resolving team…", () => fetchTeams({ competition }));
    if (!teamsResult.success) {
      throw teamsResult.error;
    }
    const teamId = await resolveTeamOrPrompt(args.team, teamsResult.data);

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
