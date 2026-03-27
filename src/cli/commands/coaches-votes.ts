import { defineCommand } from "citty";
import { fetchCoachesVotes } from "../../index";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
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
    season: { type: "string", description: "Season year (e.g. 2024)", required: true },
    round: { type: "string", description: "Round number" },
    competition: {
      type: "string",
      description: "Competition code (AFLM or AFLW)",
      default: "AFLM",
    },
    team: { type: "string", description: "Filter by team name" },
    json: { type: "boolean", description: "Output as JSON" },
    csv: { type: "boolean", description: "Output as CSV" },
    format: { type: "string", description: "Output format: table, json, csv" },
    full: { type: "boolean", description: "Show all columns in table output" },
  },
  async run({ args }) {
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    const result = await withSpinner("Fetching coaches votes…", () =>
      fetchCoachesVotes({ season, round, competition, team: args.team }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    const teamSuffix = args.team ? ` for ${args.team}` : "";
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
  },
});
