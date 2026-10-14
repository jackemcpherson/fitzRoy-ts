/**
 * `match` command — unified entry point for match data.
 *
 * Subsumes the old `matches` and `fixture` commands. Without --status,
 * returns all matches (any state). With --status Upcoming, behaves like
 * the old `fixture` command. With --status Complete, like the old
 * `matches` command.
 */

import { Effect } from "effect";
import { fetchMatches } from "../../index";
import { defineFitzroyCommand } from "../command-builder";
import {
  COMPETITION_FLAG,
  MATCH_ID_FLAG,
  OUTPUT_FLAGS,
  ROUND_FLAG,
  SEASON_FLAG,
  SOURCE_FLAG,
  STATUS_FLAG,
  TEAM_FLAG,
} from "../flags";
import type { TableColumnConfig } from "../formatters/index";
import { resolveTeamNameOrPrompt } from "../resolvers";
import {
  validateCompetition,
  validateMatchId,
  validateMatchStatus,
  validateRound,
  validateSeason,
  validateSource,
} from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "date", label: "Date", maxWidth: 16 },
  { key: "roundNumber", label: "Round", maxWidth: 6 },
  { key: "homeTeam", label: "Home", maxWidth: 20 },
  { key: "awayTeam", label: "Away", maxWidth: 20 },
  { key: "homePoints", label: "H.Pts", maxWidth: 6 },
  { key: "awayPoints", label: "A.Pts", maxWidth: 6 },
  { key: "venue", label: "Venue", maxWidth: 24 },
];

export const matchCommand = defineFitzroyCommand({
  meta: {
    name: "match",
    description: "Fetch matches (results, fixtures, or any combination via --status)",
  },
  args: {
    ...SEASON_FLAG,
    ...ROUND_FLAG,
    ...SOURCE_FLAG,
    ...COMPETITION_FLAG,
    ...TEAM_FLAG,
    ...STATUS_FLAG,
    ...MATCH_ID_FLAG,
    ...OUTPUT_FLAGS,
  },
  columns: DEFAULT_COLUMNS,
  spinner: "Fetching matches…",
  run: (args) =>
    Effect.gen(function* () {
      const season = yield* Effect.fromResult(validateSeason(args.season));
      const round = args.round ? yield* Effect.fromResult(validateRound(args.round)) : undefined;
      const source = yield* Effect.fromResult(validateSource(args.source));
      const competition = yield* Effect.fromResult(validateCompetition(args.competition));

      const status = args.status
        ? yield* Effect.fromResult(validateMatchStatus(args.status))
        : undefined;

      const team = args.team ? yield* resolveTeamNameOrPrompt(args.team) : undefined;

      const matchId = args.id
        ? yield* Effect.fromResult(validateMatchId(source, args.id))
        : undefined;

      return yield* fetchMatches({
        source,
        season,
        round,
        matchId,
        team,
        status,
        competition,
      });
    }),
  summary: (data, args) => {
    const filters: string[] = [args.season];

    if (args.round) filters.push(`round ${args.round}`);

    if (args.status) filters.push(`status=${args.status}`);

    return `Loaded ${data.length} matches (${filters.join(", ")})`;
  },
});
