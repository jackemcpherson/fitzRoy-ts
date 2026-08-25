/**
 * Pure data-shaping helpers for the `stats` command handler.
 *
 * The pipeline applied to raw stat rows before they reach the formatter:
 *   1. Participant filter — keep only rows whose team played in the resolved
 *      match (cross-source workaround, see #123).
 *   2. Team filter — narrow to a single team when --team is supplied.
 *   3. Fuzzy player filter — select rows whose displayName matches the query
 *      (threshold 0.4, maxResults 50).
 *
 * Keeping these steps here instead of inline in the command's run() closure
 * means they can be tested without spinning up a CLI process.
 */

import { fuzzySearch } from "../lib/fuzzy";
import { normaliseTeamName } from "../lib/team-mapping";
import type { PlayerStats, TeamStatsEntry } from "../types";

function teamNamesEqual(left: string, right: string): boolean {
  return (
    normaliseTeamName(left).toLocaleLowerCase("en-AU") ===
    normaliseTeamName(right).toLocaleLowerCase("en-AU")
  );
}

/** Options controlling which rows survive the filter pipeline. */
export interface StatsFilterOptions {
  /**
   * When the --match flag resolved to a known game, its participants are
   * passed here so sources that ignore matchId at the adapter layer (#123)
   * still return only the two teams that played.
   */
  readonly participants?: { readonly homeTeam: string; readonly awayTeam: string } | undefined;
  /** Resolved team name from --team; rows for other teams are dropped. */
  readonly team?: string | undefined;
  /** Raw --player query string; fuzzy-matched against displayName. */
  readonly player?: string | undefined;
}

/**
 * Apply the ordered stat-row filter pipeline.
 *
 * @param stats - Full list of player stat rows returned by the API/scraper.
 * @param options - Filter parameters derived from CLI flags.
 * @returns The filtered (and for the player fuzzy step, reordered by match
 *   score) stat rows.
 */
export function applyStatsFilters(
  stats: readonly PlayerStats[],
  options: StatsFilterOptions,
): PlayerStats[] {
  const { participants, team, player } = options;

  // Sources other than afl-api ignore matchId at the adapter layer (#123).
  // When --match resolved to a known game, post-filter to its participants
  // so cross-source behaviour matches afl-api's per-match scoping.
  let data: PlayerStats[] = [...stats];
  if (participants) {
    const { homeTeam, awayTeam } = participants;
    data = data.filter(
      (entry) => teamNamesEqual(entry.team, homeTeam) || teamNamesEqual(entry.team, awayTeam),
    );
  }
  if (team) {
    data = data.filter((entry) => teamNamesEqual(entry.team, team));
  }
  if (player) {
    const playerMatches = fuzzySearch(player, data, (p) => p.displayName, {
      maxResults: 50,
      threshold: 0.4,
    });
    data = playerMatches.map((m) => m.item);
  }
  return data;
}

/** Filter season team-stat rows by a canonical team name. */
export function filterTeamStats(
  stats: readonly TeamStatsEntry[],
  team: string | undefined,
): TeamStatsEntry[] {
  if (team === undefined) return [...stats];
  return stats.filter((entry) => teamNamesEqual(entry.team, team));
}
