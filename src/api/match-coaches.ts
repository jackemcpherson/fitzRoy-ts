/** Public API for credited coach assignments by match. */

import { Result } from "../lib/result";
import { dispatch } from "../sources/adapters/dispatch";
import { matchCoachesRegistry } from "../sources/adapters/index";
import type { MatchCoachesQuery, MatchCoachesResult } from "../types";

/**
 * Fetch source-grounded credited coaches for every match in a season.
 * AFL Tables is the default provider. FootyWire season requests remain
 * unsupported pending captured match-heading evidence. Incomplete page coverage is reported in the successful result.
 *
 * @param query - Season, optional team, competition, and provider selection.
 * @returns Assignments with completeness metadata, or an expected error.
 * @example
 * ```ts
 * const result = await fetchMatchCoaches({ season: 2022, team: "Carlton" });
 * ```
 */
export async function fetchMatchCoaches(
  query: MatchCoachesQuery,
): Promise<import("../lib/result").Result<MatchCoachesResult, Error>> {
  const resolved = { ...query, source: query.source ?? "afl-tables" };
  const adapterR = dispatch(matchCoachesRegistry, "match coach", resolved);
  return Result.flatMapAsync(adapterR, (adapter) => adapter.fetchMatchCoaches(resolved));
}
