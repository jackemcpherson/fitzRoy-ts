/**
 * Public API for fetching player biographical details.
 *
 * PlayerDetails is a denormalised view of `Squad` data — one flat row
 * per player with team name + provenance baked in (per CONTEXT.md:
 * *"Squad … subsumes any per-source 'player list' notion"*). The
 * dispatch goes through `squadRegistry`, then a pure transform spreads
 * the squad into rows.
 */

import { batchedMap } from "../lib/concurrency";
import { ok, type Result } from "../lib/result";
import { AFL_SENIOR_TEAMS } from "../lib/team-mapping";
import { squadToPlayerDetails } from "../transforms/player-details";
import type { PlayerDetails, PlayerDetailsQuery } from "../types";
import { fetchSquad } from "./teams";

/**
 * Fetch player biographical details (DOB, height, draft info, etc.).
 *
 * `query.team` selects one team; omit it to fetch every senior team.
 * Career counts (`gamesPlayed`, `goals`) come from the source's
 * team-list page on FootyWire and AFL Tables; AFL API doesn't carry
 * career stats so they stay `null` for that source.
 *
 * @example
 * ```ts
 * const result = await fetchPlayerDetails({
 *   source: "afl-api",
 *   team: "Carlton",
 *   season: 2025,
 * });
 * ```
 */
export async function fetchPlayerDetails(
  query: PlayerDetailsQuery,
): Promise<Result<PlayerDetails[], Error>> {
  const competition = query.competition ?? "AFLM";

  if (query.team) {
    const squadR = await fetchSquad({
      team: query.team,
      season: query.season ?? new Date().getFullYear(),
      source: query.source,
      competition,
    });
    if (!squadR.success) return squadR;
    return ok(squadToPlayerDetails(squadR.data, query.source));
  }

  const teamNames = [...AFL_SENIOR_TEAMS];
  const results = await batchedMap(teamNames, (team) =>
    fetchSquad({
      team,
      season: query.season ?? new Date().getFullYear(),
      source: query.source,
      competition,
    }),
  );

  const allPlayers: PlayerDetails[] = [];
  for (const result of results) {
    if (result.success) {
      allPlayers.push(...squadToPlayerDetails(result.data, query.source));
    }
  }
  return ok(allPlayers);
}
