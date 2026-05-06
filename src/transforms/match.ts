/**
 * Pure transforms over already-normalised Match data.
 *
 * Source-specific flattening lives in `match-results.ts` (AFL API).
 * Functions here operate on the unified `Match` type and are
 * source-agnostic.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import type { Match, MatchQuery } from "../types";

/**
 * Apply matchId / team / status filters that the source didn't already
 * apply. Used by the public `fetchMatches` pipeline after the adapter
 * returns its raw match list.
 */
export function filterMatches(matches: readonly Match[], query: MatchQuery): Match[] {
  let filtered: readonly Match[] = matches;
  if (query.matchId !== undefined) {
    filtered = filtered.filter((m) => m.matchId === query.matchId);
  }
  if (query.team !== undefined) {
    const target = normaliseTeamName(query.team);
    filtered = filtered.filter((m) => m.homeTeam === target || m.awayTeam === target);
  }
  if (query.status !== undefined) {
    filtered = filtered.filter((m) => m.status === query.status);
  }
  return [...filtered];
}
