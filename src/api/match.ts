/**
 * Public API for fetching matches across data sources.
 *
 * Subsumes the old `fetchMatchResults` and `fetchFixture`. Use the `status`
 * filter to scope to upcoming or completed matches; omit it to get all.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 */

import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import {
  allMatchSources,
  checkCoverage,
  findAlternativeSource,
  getMatchSource,
  listMatchSources,
  unsupportedSourceForOperation,
} from "../sources/adapters/index";
import type { Match, MatchQuery } from "../types";

/**
 * Fetch matches matching the query.
 *
 * @example
 * ```ts
 * // All AFLM matches in 2025 round 3
 * await fetchMatches({ source: "afl-api", season: 2025, round: 3 });
 *
 * // Only upcoming matches (a "fixture" view)
 * await fetchMatches({ source: "afl-api", season: 2025, status: "Upcoming" });
 *
 * // One specific match by id
 * await fetchMatches({ source: "afl-api", season: 2025, matchId: "CD_M..." });
 * ```
 */
export async function fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
  const adapter = getMatchSource(query.source);
  if (!adapter) {
    return err(unsupportedSourceForOperation(query.source, "match", listMatchSources()));
  }

  const competition = query.competition ?? "AFLM";
  const alternative = findAlternativeSource(allMatchSources(), {
    source: query.source,
    competition,
    season: query.season,
  });
  const suggestion = alternative ? `--source ${alternative}` : undefined;
  const coverage = checkCoverage(
    adapter.coverage,
    { source: query.source, operation: "match", competition, season: query.season },
    suggestion,
  );
  if (!coverage.success) return coverage;

  const fetched = await adapter.fetchMatches(query);
  if (!fetched.success) return fetched;
  return ok(applyClientFilters(fetched.data, query));
}

/** Apply matchId/team/status filters that the source didn't already apply. */
function applyClientFilters(matches: readonly Match[], query: MatchQuery): Match[] {
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
