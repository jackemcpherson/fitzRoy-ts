import { defineCommand } from "citty";
import { fetchLineup } from "../../index";
import type { Lineup } from "../../types";
import {
  type FormatOptions,
  formatOutput,
  resolveFormat,
  type TableColumnConfig,
} from "../formatters/index";
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
    season: { type: "string", description: "Season year (e.g. 2025)", required: true },
    round: { type: "string", description: "Round number", required: true },
    "match-id": { type: "string", description: "Specific match ID" },
    source: { type: "string", description: "Data source", default: "afl-api" },
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
    const round = validateRound(args.round);
    const matchId = args["match-id"];
    const source = validateSource(args.source);
    const competition = validateCompetition(args.competition);
    const format = validateFormat(args.format);

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
  },
});
