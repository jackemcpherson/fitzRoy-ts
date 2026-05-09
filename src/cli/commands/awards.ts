/**
 * `awards` command — season recognition (Brownlow, Coleman, Coaches,
 * All-Australian, Rising Star).
 *
 * One CLI verb hides the fetched-vs-computed source heterogeneity
 * (Brownlow/Coaches/AA/RisingStar are scraped; Coleman is computed
 * from PlayerStats).
 */

import { fetchAwards } from "../../index";
import { defineFitzroyCommand } from "../command-builder";
import {
  AWARD_TYPE_FLAG,
  COMPETITION_FLAG,
  OUTPUT_FLAGS,
  ROUND_FLAG,
  SEASON_FLAG,
  TEAM_FLAG,
} from "../flags";
import type { TableColumnConfig } from "../formatters/index";
import { resolveTeamNameOrPrompt } from "../resolvers";
import {
  validateAwardType,
  validateCompetition,
  validateLimit,
  validateRound,
  validateSeason,
} from "../validation";

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: "position", label: "Pos", maxWidth: 4 },
  { key: "player", label: "Player", maxWidth: 28 },
  { key: "team", label: "Team", maxWidth: 20 },
  { key: "votes", label: "Votes", maxWidth: 6 },
  { key: "goals", label: "Goals", maxWidth: 6 },
];

interface AwardsArgs {
  type: string;
  season: string;
  round?: string;
  competition: string;
  team?: string;
  limit?: string;
}

export const awardsCommand = defineFitzroyCommand<AwardsArgs & Record<string, unknown>, object>({
  meta: {
    name: "awards",
    description: "Fetch season awards (brownlow, coleman, coaches, all-australian, rising-star)",
  },
  args: {
    ...AWARD_TYPE_FLAG,
    ...SEASON_FLAG,
    ...ROUND_FLAG,
    ...COMPETITION_FLAG,
    ...TEAM_FLAG,
    limit: { type: "string", description: "Limit results (e.g. top N for Coleman)" },
    ...OUTPUT_FLAGS,
  },
  columns: DEFAULT_COLUMNS,
  spinner: "Fetching awards…",
  run: async (args) => {
    const award = validateAwardType(args.type);
    const season = validateSeason(args.season);
    const round = args.round ? validateRound(args.round) : undefined;
    const competition = validateCompetition(args.competition);
    const team = args.team ? await resolveTeamNameOrPrompt(args.team) : undefined;
    const limit = validateLimit(args.limit);

    if (round != null && award !== "coaches") {
      throw new Error(
        `--round is not supported for --type ${award}. Round-scoped data is only available for coaches votes; brownlow, all-australian, rising-star, and coleman are season-level.`,
      );
    }

    return fetchAwards({ award, season, round, competition, team, limit });
  },
  summary: (data, args) => `Loaded ${data.length} ${args.type} entries for ${args.season}`,
});
