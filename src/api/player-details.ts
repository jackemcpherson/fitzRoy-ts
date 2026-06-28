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
import { err, ok, type Result } from "../lib/result";
import { AFL_SENIOR_TEAMS } from "../lib/team-mapping";
import { dispatch, squadRegistry } from "../sources/adapters/index";
import { squadToPlayerDetails } from "../transforms/player-details";
import type { PlayerDetails, PlayerDetailsQuery } from "../types";
import { resolveDefaultSeasonForCompetition } from "./season";
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
  // Resolve the default season once, data-driven (current in-progress, else
  // most recently completed — from the AFL round schedule, not the local
  // calendar year), with the same offline fallback as the CLI. Resolving here
  // guarantees a single lookup even on the all-teams path. (#149)
  const season = query.season ?? (await resolveDefaultSeasonForCompetition(competition));

  // Verify the chosen source actually exposes squad data before iterating.
  // Without this guard, sources like fryzigg (player-stats only) silently
  // returned [] for every team and the all-teams loop produced an empty
  // array with exit 0 — masking a configuration error. (#126)
  const dispatchResult = dispatch(squadRegistry, "squad", {
    source: query.source,
    competition,
    season,
  });
  if (!dispatchResult.success) return err(dispatchResult.error);

  if (query.team) {
    const squadR = await fetchSquad({
      team: query.team,
      season,
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
      season,
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
