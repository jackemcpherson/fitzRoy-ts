/**
 * Pure data-shaping helpers for the `team` command handler.
 *
 * Three filter steps extracted from `team.ts` so they can be tested without
 * running a CLI process — matching the pattern established in
 * `src/cli/queries.ts` and `src/cli/stats-filters.ts`.
 *
 *   1. `filterLineupsByTeam` — keep only Lineup records where a given team
 *      played (lineup-mode pre-filter on the envelope).
 *   2. `flattenLineups` — expand Lineup records to one row per player,
 *      optionally narrowed to one side.
 *   3. `filterTeamList` — case-insensitive name/abbreviation/teamId filter
 *      for the team-list mode; fails on no match so the handler stays
 *      purely presentational.
 */

import { Result } from "effect";
import { normaliseTeamName } from "../lib/team-mapping";
import type { Lineup, LineupPlayer, Team } from "../types";
import { usage, type Validated } from "./validation";

/** One player row of a flattened lineup. */
export type LineupRow = Pick<
  LineupPlayer,
  "displayName" | "jumperNumber" | "matchPosition" | "isEmergency" | "isSubstitute"
> & {
  readonly matchId: string;
  readonly team: string;
};

/** Compare canonical team names without case sensitivity. */
function teamNamesEqual(left: string, right: string): boolean {
  return (
    normaliseTeamName(left).toLocaleLowerCase("en-AU") ===
    normaliseTeamName(right).toLocaleLowerCase("en-AU")
  );
}

/**
 * Keep only lineups in which `teamName` participated.
 *
 * @param lineups - Full list of lineups from the library.
 * @param teamName - Exact resolved team name to retain.
 * @returns Lineups where `homeTeam` or `awayTeam` equals `teamName`.
 */
export function filterLineupsByTeam(lineups: readonly Lineup[], teamName: string): Lineup[] {
  return lineups.filter(
    (lineup) =>
      teamNamesEqual(lineup.homeTeam, teamName) || teamNamesEqual(lineup.awayTeam, teamName),
  );
}

/**
 * Flatten a set of lineups to one row per player, optionally filtered to a
 * single team.
 *
 * @param lineups - Raw lineup records from the library.
 * @param teamFilter - When supplied, only rows for this team are included.
 * @returns One row per player, stamped with `matchId` and `team`.
 */
export function flattenLineups(
  lineups: readonly Lineup[],
  teamFilter?: string,
): LineupRow[] {
  const rows: LineupRow[] = [];

  for (const lineup of lineups) {
    for (const { players, team } of [
      { players: lineup.homePlayers, team: lineup.homeTeam },
      { players: lineup.awayPlayers, team: lineup.awayTeam },
    ]) {
      if (teamFilter != null && !teamNamesEqual(team, teamFilter)) continue;

      for (const p of players) {
        rows.push({
          matchId: lineup.matchId,
          team,
          displayName: p.displayName,
          jumperNumber: p.jumperNumber,
          matchPosition: p.matchPosition,
          isEmergency: p.isEmergency,
          isSubstitute: p.isSubstitute,
        });
      }
    }
  }

  return rows;
}

/**
 * Filter a team list by name, abbreviation, or teamId.
 *
 * The "no match" error is produced here rather than in the command handler so
 * that `team.ts` stays purely presentational — it passes the data and the
 * query, and this function owns the match-or-fail semantics. The error
 * message lists all available teams so the caller doesn't need to reconstruct
 * the alternatives string.
 *
 * @param teams - Full team list to filter.
 * @param query - User-supplied name, abbreviation, or teamId (case-insensitive
 *   for name and abbreviation; exact-match for teamId).
 * @returns Matching teams (may be more than one when abbreviations collide),
 *   or a usage error when no team matches `query`.
 */
export function filterTeamList(teams: readonly Team[], query: string): Validated<Team[]> {
  const target = query.toLowerCase();

  const filtered = teams.filter(
    (t) =>
      t.name.toLowerCase() === target ||
      t.abbreviation.toLowerCase() === target ||
      t.teamId === query,
  );

  if (filtered.length === 0) {
    return usage(
      `No team matched "${query}". Available: ${teams.map((t) => `${t.name} (${t.abbreviation})`).join(", ")}`,
    );
  }

  return Result.succeed(filtered);
}
