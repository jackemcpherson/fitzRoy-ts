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
 *      for the team-list mode; throws on no match so the handler stays
 *      purely presentational.
 */

import type { Lineup, Team } from "../types";

/**
 * Keep only lineups in which `teamName` participated.
 *
 * @param lineups - Full list of lineups from the library.
 * @param teamName - Exact resolved team name to retain.
 * @returns Lineups where `homeTeam` or `awayTeam` equals `teamName`.
 */
export function filterLineupsByTeam(lineups: readonly Lineup[], teamName: string): Lineup[] {
  return lineups.filter((l) => l.homeTeam === teamName || l.awayTeam === teamName);
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
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const lineup of lineups) {
    for (const { players, team } of [
      { players: lineup.homePlayers, team: lineup.homeTeam },
      { players: lineup.awayPlayers, team: lineup.awayTeam },
    ]) {
      if (teamFilter != null && team !== teamFilter) continue;
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
 * The "no match" error is thrown here rather than in the command handler so
 * that `team.ts` stays purely presentational — it passes the data and the
 * query, and this function owns the match-or-throw semantics. The error
 * message lists all available teams so the caller doesn't need to reconstruct
 * the alternatives string.
 *
 * @param teams - Full team list to filter.
 * @param query - User-supplied name, abbreviation, or teamId (case-insensitive
 *   for name and abbreviation; exact-match for teamId).
 * @returns Matching teams (may be more than one when abbreviations collide).
 * @throws {Error} When no team matches `query`.
 */
export function filterTeamList(teams: readonly Team[], query: string): Team[] {
  const target = query.toLowerCase();
  const filtered = teams.filter(
    (t) =>
      t.name.toLowerCase() === target ||
      t.abbreviation.toLowerCase() === target ||
      t.teamId === query,
  );
  if (filtered.length === 0) {
    throw new Error(
      `No team matched "${query}". Available: ${teams.map((t) => `${t.name} (${t.abbreviation})`).join(", ")}`,
    );
  }
  return filtered;
}
