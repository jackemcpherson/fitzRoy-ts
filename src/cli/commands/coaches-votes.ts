import { defineCommand } from "citty";
import { fetchCoachesVotes } from "../../index";
import { withErrorBoundary } from "../error-boundary";
import { COMPETITION_FLAG, OUTPUT_FLAGS, ROUND_FLAG, SEASON_FLAG, TEAM_FLAG } from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { resolveTeamNameOrPrompt } from "../resolvers";
import { showSummary, withSpinner } from "../ui";
import { validateCompetition, validateFormat, validateRound, validateSeason } from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "season", label: "Season", maxWidth: 8 },
  { key: "round", label: "Round", maxWidth: 6 },
  { key: "homeTeam", label: "Home", maxWidth: 20 },
  { key: "awayTeam", label: "Away", maxWidth: 20 },
  { key: "playerName", label: "Player", maxWidth: 30 },
  { key: "votes", label: "Votes", maxWidth: 6 },
];

export const coachesVotesCommand = defineCommand({
  meta: {
    name: "coaches-votes",
    description: "Fetch AFLCA coaches votes for a season",
  },
  args: {
    ...SEASON_FLAG,
    ...ROUND_FLAG,
    ...COMPETITION_FLAG,
    ...TEAM_FLAG,
    ...OUTPUT_FLAGS,
  },
  run: withErrorBoundary(async ({ args }) => {
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    // Resolve team name via fuzzy matching if provided
    const team = args.team ? await resolveTeamNameOrPrompt(args.team) : undefined;

    const result = await withSpinner("Fetching coaches votes…", () =>
      fetchCoachesVotes({ season, round, competition, team }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    const teamSuffix = team ? ` for ${team}` : "";
    const roundSuffix = round ? ` round ${round}` : "";
    showSummary(`Loaded ${data.length} vote records for ${season}${roundSuffix}${teamSuffix}`);

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
