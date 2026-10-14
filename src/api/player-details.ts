/**
 * Public API for fetching player biographical details.
 *
 * PlayerDetails is a denormalised view of `Squad` data — one flat row
 * per player with team name + provenance baked in (per CONTEXT.md:
 * *"Squad … subsumes any per-source 'player list' notion"*). The
 * dispatch goes through `squadRegistry`, then a pure transform spreads
 * the squad into rows.
 */

import { Effect, Result } from "effect";
import { batched } from "../lib/batched";
import { IncompleteDataError, type SourceError } from "../lib/errors";
import { AFL_SENIOR_TEAMS } from "../lib/team-mapping";
import type { AflApi } from "../sources/afl-api";
import { dispatch, SourceRegistry } from "../sources/adapters/index";
import { squadToPlayerDetails } from "../transforms/player-details";
import type { PlayerDetails, PlayerDetailsQuery, PlayerDetailsResult } from "../types";
import { resolveDefaultSeasonForCompetition } from "./season";
import { fetchSquad } from "./teams";

/**
 * Fetch player biographical details (DOB, height, draft info, etc.).
 *
 * `query.team` selects one team; omit it to fetch every senior team.
 * Career counts (`gamesPlayed`, `goals`) come from the source's
 * team-list page on FootyWire and AFL Tables; AFL API doesn't carry
 * career stats so they stay `null` for that source.
 * All-team requests retain successful squads and list failed team names.
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
export function fetchPlayerDetails(
  query: PlayerDetailsQuery,
): Effect.Effect<PlayerDetailsResult, SourceError, SourceRegistry | AflApi> {
  return Effect.gen(function* () {
    const competition = query.competition ?? "AFLM";
    // Resolve once, preserving an explicit competition season. A failed lookup
    // remains an error rather than substituting a calendar-year approximation.
    const season = query.season ?? (yield* resolveDefaultSeasonForCompetition(competition));
    const registry = yield* SourceRegistry;

    // Verify the chosen source actually exposes squad data before iterating.
    // Without this guard, sources like fryzigg (player-stats only) silently
    // returned [] for every team and the all-teams loop produced an empty
    // array with exit 0 — masking a configuration error. (#126)
    yield* dispatch(registry.squad, "squad", { source: query.source, competition, season });

    if (query.team) {
      const squad = yield* fetchSquad({
        team: query.team,
        season,
        source: query.source,
        competition,
      });

      return {
        players: squadToPlayerDetails(squad, query.source),
        failedTeams: [],
        scope: squad.scope,
      };
    }

    const teamNames = [...AFL_SENIOR_TEAMS];

    const results = yield* batched(teamNames, (team) =>
      Effect.result(fetchSquad({ team, season, source: query.source, competition })).pipe(
        Effect.map((result) => ({ team, result })),
      ),
    );

    const failures = results.flatMap(({ result }) =>
      Result.isFailure(result) ? [result.failure] : [],
    );

    const first = failures[0];

    if (first !== undefined && failures.length === results.length) {
      return yield* new IncompleteDataError({
        message: `All ${results.length} team squad fetches failed for season ${season} (source: ${query.source}); first error: ${first.message}`,
        cause: first,
      });
    }

    const allPlayers: PlayerDetails[] = [];
    const failedTeams: string[] = [];
    let scope: PlayerDetailsResult["scope"] | undefined;

    for (const { team, result } of results) {
      if (Result.isSuccess(result)) {
        allPlayers.push(...squadToPlayerDetails(result.success, query.source));
        scope ??= result.success.scope;
      } else {
        failedTeams.push(team);
      }
    }

    if (scope === undefined) {
      return yield* new IncompleteDataError({
        message: `No player details found for season ${season} (source: ${query.source})`,
      });
    }

    return { players: allPlayers, failedTeams, scope };
  });
}
