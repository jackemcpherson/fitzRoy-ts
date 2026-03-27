import { defineCommand } from "citty";
import { fetchLineup } from "../../index";
import { AflApiClient } from "../../sources/afl-api";
import type { Lineup } from "../../types";
import { withErrorBoundary } from "../error-boundary";
import {
  COMPETITION_FLAG,
  OUTPUT_FLAGS,
  REQUIRED_ROUND_FLAG,
  SEASON_FLAG,
  SOURCE_FLAG,
} from "../flags";
import {
  type FormatOptions,
  formatOutput,
  resolveFormat,
  type TableColumnConfig,
} from "../formatters/index";
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
  { key: "matchId", label: "Match", maxWidth: 14 },
  { key: "team", label: "Team", maxWidth: 20 },
  { key: "displayName", label: "Player", maxWidth: 24 },
  { key: "jumperNumber", label: "#", maxWidth: 4 },
  { key: "position", label: "Pos", maxWidth: 12 },
];

/** Flatten lineups to per-player rows for table/CSV display. */
function flattenLineups(lineups: readonly Lineup[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const lineup of lineups) {
    for (const { players, team } of [
      { players: lineup.homePlayers, team: lineup.homeTeam },
      { players: lineup.awayPlayers, team: lineup.awayTeam },
    ]) {
      for (const p of players) {
        rows.push({
          matchId: lineup.matchId,
          team,
          displayName: p.displayName,
          jumperNumber: p.jumperNumber,
          position: p.position,
          isEmergency: p.isEmergency,
          isSubstitute: p.isSubstitute,
        });
      }
    }
  }
  return rows;
}

export const lineupCommand = defineCommand({
  meta: {
    name: "lineup",
    description: "Fetch match lineups for a round",
  },
  args: {
    ...SEASON_FLAG,
    ...REQUIRED_ROUND_FLAG,
    match: { type: "string", description: "Filter by team name to find a specific match" },
    "match-id": { type: "string", description: "Specific match provider ID (advanced)" },
    ...SOURCE_FLAG,
    ...COMPETITION_FLAG,
    ...OUTPUT_FLAGS,
  },
  run: withErrorBoundary(async ({ args }) => {
    const season = validateSeason(args.season);
    const round = validateRound(args.round);
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

    // Resolve --match (team name) to a match ID if provided
    let matchId = args["match-id"];
    if (!matchId && args.match) {
      const client = new AflApiClient();
      const seasonResult = await client.resolveCompSeason(competition, season);
      if (!seasonResult.success) throw seasonResult.error;
      const itemsResult = await client.fetchRoundMatchItemsByNumber(seasonResult.data, round);
      if (!itemsResult.success) throw itemsResult.error;
      matchId = await resolveMatchOrPrompt(args.match, itemsResult.data);
    }

    const result = await withSpinner("Fetching lineups…", () =>
      fetchLineup({ source, season, round, matchId, competition }),
    );

    if (!result.success) {
      throw result.error;
    }

    const data = result.data;
    showSummary(`Loaded ${data.length} lineups for ${season} round ${round}`);

    const formatOptions: FormatOptions = {
      json: args.json,
      csv: args.csv,
      format,
      full: args.full,
      columns: DEFAULT_COLUMNS,
    };

    // JSON keeps nested structure; table/CSV flatten to per-player rows
    const resolvedFormat = resolveFormat(formatOptions);
    if (resolvedFormat === "json") {
      console.log(formatOutput(data, formatOptions));
    } else {
      console.log(formatOutput(flattenLineups(data), formatOptions));
    }
  }),
});
