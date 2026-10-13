/**
 * Fryzigg source adapter.
 *
 * Fryzigg distributes static RDS dumps. Only PlayerStats is published —
 * no match results, ladders, or squads. Coverage: AFLM and AFLW.
 */

import { Effect, Result } from "effect";
import { UnsupportedSourceError } from "../../lib/errors";
import { seasonYear } from "../../lib/seasons";
import { transformFryziggPlayerStats } from "../../transforms/fryzigg-player-stats";
import { Fryzigg } from "../fryzigg";
import { FRYZIGG_SNAPSHOTS } from "../fryzigg-snapshots";
import type { PlayerStatsSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const FRYZIGG_PLAYER_STATS_COVERAGE: CoverageMap = new Map([
  [
    "AFLM",
    {
      minSeason: FRYZIGG_SNAPSHOTS.AFLM.minSeason,
      maxSeason: FRYZIGG_SNAPSHOTS.AFLM.maxSeason,
    },
  ],
  [
    "AFLW",
    {
      minSeason: FRYZIGG_SNAPSHOTS.AFLW.minSeason,
      maxSeason: FRYZIGG_SNAPSHOTS.AFLW.maxSeason,
    },
  ],
]);

/** Fryzigg as a PlayerStatsSource (AFLM and AFLW only). */
export const fryziggPlayerStatsSource: Effect.Effect<PlayerStatsSource, never, Fryzigg> =
  Effect.gen(function* () {
    const client = yield* Fryzigg;

    return {
      id: "fryzigg",
      coverage: FRYZIGG_PLAYER_STATS_COVERAGE,
      fetchPlayerStats: (query) =>
        Effect.gen(function* () {
          const competition = query.competition ?? "AFLM";

          // The pinned AFLW dump was last updated in January 2022, during season six.
          // Its calendar-year column cannot supply season seven.
          if (competition === "AFLW" && query.season === "2022-S7")
            return yield* Effect.fail(
              new UnsupportedSourceError({
                message:
                  "Fryzigg's January 2022 snapshot covers season six only; use afl-api for 2022-S7",
                source: "fryzigg",
              }),
            );
          const frame = yield* client.fetchPlayerStats(competition);

          const transformed = transformFryziggPlayerStats(frame, {
            competition,
            season: seasonYear(query.season),
            round: query.round,
          });

          if (Result.isFailure(transformed)) return yield* Effect.fail(transformed.failure);

          // Fryzigg is a single bulk download — there are no per-game fetches
          // that can partially fail, so failedMatchIds is always empty.
          return { stats: transformed.success, failedMatchIds: [] };
        }),
    };
  });
