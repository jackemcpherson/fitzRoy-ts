/**
 * Public API for fetching team-level aggregate statistics.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`).
 *
 * Note: AFL API has no team-stats endpoint, so the senior fallback (and
 * the suggestion target) is `afl-tables` (see `teamStatsRegistry.defaultSource`).
 */

import { Effect } from "effect";
import { ScrapeError, type SourceError } from "../lib/errors";
import { dispatch, SourceRegistry } from "../sources/adapters/index";
import type { TeamStatsEntry, TeamStatsQuery } from "../types";

/**
 * Fetch team-level aggregate statistics for a season.
 *
 * Team-stat sources currently cover AFLM only. Dispatch validates the requested
 * competition before an adapter performs network access.
 * AFL Tables totals can contain `gamesPlayed: null` when match enrichment fails.
 * Averages fail when any denominator is missing or non-positive.
 *
 * @example
 * ```ts
 * const result = await fetchTeamStats({ source: "footywire", season: 2024 });
 * ```
 */
export function fetchTeamStats(
  query: TeamStatsQuery,
): Effect.Effect<TeamStatsEntry[], SourceError, SourceRegistry> {
  return Effect.gen(function* () {
    const registry = yield* SourceRegistry;
    const adapter = yield* dispatch(registry.teamStats, "team stats", query);
    const fetched = yield* adapter.fetchTeamStats(query);
    const entries = fetched.map((entry) => ({ ...entry, seasonKey: String(query.season) }));

    if (query.summaryType !== "averages") return entries;
    const invalid = entries.filter((entry) => entry.gamesPlayed === null || entry.gamesPlayed <= 0);

    if (invalid.length > 0) {
      return yield* new ScrapeError({
        message: `Cannot return team-stat averages because games played is missing or non-positive for: ${invalid.map((entry) => entry.team).join(", ")}`,
        source: query.source,
      });
    }

    return entries;
  });
}
