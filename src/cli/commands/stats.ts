import { defineCommand } from "citty";
import { fetchPlayerStats } from "../../index";
import { fuzzySearch } from "../../lib/fuzzy";
import { AflApiClient } from "../../sources/afl-api";
import {
  COMPETITION_FLAG,
  OUTPUT_FLAGS,
  PLAYER_FLAG,
  ROUND_FLAG,
  SEASON_FLAG,
  SOURCE_FLAG,
} from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { resolveMatchOrPrompt } from "../resolvers";
import { showSummary, withSpinner } from "../ui";
import {
  validateCompetition,
  validateFormat,
  validateRound,
  validateSeason,
  validateSource,
} from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "displayName", label: "Player", maxWidth: 22 },
  { key: "team", label: "Team", maxWidth: 18 },
  { key: "disposals", label: "Disp", maxWidth: 6 },
  { key: "kicks", label: "Kicks", maxWidth: 6 },
  { key: "handballs", label: "HB", maxWidth: 6 },
  { key: "marks", label: "Marks", maxWidth: 6 },
  { key: "goals", label: "Goals", maxWidth: 6 },
];

export const statsCommand = defineCommand({
  meta: {
    name: "stats",
    description: "Fetch player statistics for a season",
  },
  args: {
    ...SEASON_FLAG,
    ...ROUND_FLAG,
    match: { type: "string", description: "Filter by team name to find a specific match" },
    "match-id": { type: "string", description: "Specific match provider ID (advanced)" },
    ...SOURCE_FLAG,
    ...COMPETITION_FLAG,
    ...PLAYER_FLAG,
    ...OUTPUT_FLAGS,
  },
  async run({ args }) {
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    // Resolve --match (team name) to a match ID if provided
    let matchId = args["match-id"];
    if (!matchId && args.match && round != null) {
      const client = new AflApiClient();
      const seasonResult = await client.resolveCompSeason(competition, season);
      if (!seasonResult.success) throw seasonResult.error;
      const itemsResult = await client.fetchRoundMatchItemsByNumber(seasonResult.data, round);
      if (!itemsResult.success) throw itemsResult.error;
      matchId = await resolveMatchOrPrompt(args.match, itemsResult.data);
    } else if (args.match && round == null) {
      throw new Error("--match requires --round (-r) to identify which round to search.");
    }

    const result = await withSpinner("Fetching player stats…", () =>
      fetchPlayerStats({ source, season, round, matchId, competition }),
    );

    if (!result.success) {
      throw result.error;
    }

    let data = result.data;

    // Post-fetch player name filtering
    if (args.player) {
      const playerMatches = fuzzySearch(args.player, data, (p) => p.displayName, {
        maxResults: 50,
        threshold: 0.4,
      });
      data = playerMatches.map((m) => m.item);
    }

    showSummary(
      `Loaded ${data.length} player stat lines for ${season}${round ? ` round ${round}` : ""}`,
    );

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
