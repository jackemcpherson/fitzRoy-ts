/**
 * `awards` command — season recognition (Brownlow, Coleman, Coaches,
 * All-Australian, Rising Star).
 *
 * One CLI verb hides the fetched-vs-computed source heterogeneity
 * (Brownlow/Coaches/AA/RisingStar are scraped; Coleman is computed
 * from PlayerStats).
 *
 * Bypasses `defineFitzroyCommand` because each --type emits a different
 * variant of the `Award` discriminated union with different fields, so
 * the table column set must be picked per-type. (#97)
 */

import { defineCommand } from "citty";
import { fetchAwards } from "../../index";
import type { AwardType } from "../../types";
import { rejectUnknownFlags } from "../command-builder";
import { withErrorBoundary } from "../error-boundary";
import {
  AWARD_TYPE_FLAG,
  COMPETITION_FLAG,
  OUTPUT_FLAGS,
  ROUND_FLAG,
  SEASON_FLAG,
  TEAM_FLAG,
} from "../flags";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "../formatters/index";
import { resolveTeamNameOrPrompt } from "../resolvers";
import { showSummary, withSpinner } from "../ui";
import {
  validateAwardType,
  validateCompetition,
  validateFormat,
  validateLimit,
  validateRound,
  validateSeason,
} from "../validation";

const COLUMNS_BY_TYPE: Record<AwardType, readonly TableColumnConfig[]> = {
  brownlow: [
    { key: "player", label: "Player", maxWidth: 28 },
    { key: "team", label: "Team", maxWidth: 20 },
    { key: "votes", label: "Votes", maxWidth: 6 },
    { key: "votes3", label: "3V", maxWidth: 4 },
    { key: "votes2", label: "2V", maxWidth: 4 },
    { key: "votes1", label: "1V", maxWidth: 4 },
    { key: "polledGames", label: "Polled", maxWidth: 7 },
    { key: "isMedallist", label: "Win", maxWidth: 5 },
  ],
  "all-australian": [
    { key: "position", label: "Pos", maxWidth: 4 },
    { key: "player", label: "Player", maxWidth: 28 },
    { key: "team", label: "Team", maxWidth: 20 },
  ],
  "rising-star": [
    { key: "round", label: "Rd", maxWidth: 4 },
    { key: "player", label: "Player", maxWidth: 24 },
    { key: "team", label: "Team", maxWidth: 18 },
    { key: "opponent", label: "Opp", maxWidth: 18 },
    { key: "disposals", label: "Disp", maxWidth: 6 },
    { key: "goals", label: "Goals", maxWidth: 6 },
    { key: "tackles", label: "T", maxWidth: 4 },
  ],
  coleman: [
    { key: "rank", label: "Rank", maxWidth: 5 },
    { key: "player", label: "Player", maxWidth: 28 },
    { key: "team", label: "Team", maxWidth: 20 },
    { key: "goals", label: "Goals", maxWidth: 6 },
    { key: "gamesPlayed", label: "GP", maxWidth: 4 },
  ],
  coaches: [
    { key: "round", label: "Rd", maxWidth: 4 },
    { key: "homeTeam", label: "Home", maxWidth: 18 },
    { key: "awayTeam", label: "Away", maxWidth: 18 },
    { key: "player", label: "Player", maxWidth: 24 },
    { key: "votes", label: "Votes", maxWidth: 6 },
  ],
};

const AWARDS_ARGS = {
  ...AWARD_TYPE_FLAG,
  ...SEASON_FLAG,
  ...ROUND_FLAG,
  ...COMPETITION_FLAG,
  ...TEAM_FLAG,
  limit: { type: "string" as const, description: "Limit results (e.g. top N for Coleman)" },
  ...OUTPUT_FLAGS,
} as const;

export const awardsCommand = defineCommand({
  meta: {
    name: "awards",
    description: "Fetch season awards (brownlow, coleman, coaches, all-australian, rising-star)",
  },
  args: AWARDS_ARGS,
  run: withErrorBoundary(async ({ args }) => {
    rejectUnknownFlags(AWARDS_ARGS, process.argv);
    const award = validateAwardType(args.type as string);
    const season = validateSeason(args.season as string);
    const round = args.round ? validateRound(args.round as string) : undefined;
    const competition = validateCompetition(args.competition as string);
    const team = args.team ? await resolveTeamNameOrPrompt(args.team as string) : undefined;
    const limit = validateLimit(args.limit as string | undefined);
    const format = validateFormat(args.format as string | undefined);

    if (round != null && award !== "coaches") {
      throw new Error(
        `--round is not supported for --type ${award}. Round-scoped data is only available for coaches votes; brownlow, all-australian, rising-star, and coleman are season-level.`,
      );
    }

    const result = await withSpinner("Fetching awards…", () =>
      fetchAwards({ award, season, round, competition, team, limit }),
    );
    if (!result.success) throw result.error;

    const data = result.data;
    showSummary(`Loaded ${data.length} ${award} entries for ${season}`);

    const formatOptions: FormatOptions = {
      json: args.json as boolean | undefined,
      csv: args.csv as boolean | undefined,
      format,
      full: args.full as boolean | undefined,
      columns: COLUMNS_BY_TYPE[award],
    };
    console.log(formatOutput(data as readonly object[], formatOptions));
  }),
});
