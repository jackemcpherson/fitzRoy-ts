/**
 * Fryzigg source adapter.
 *
 * Fryzigg distributes static RDS dumps. Only PlayerStats is published —
 * no match results, ladders, or squads. Coverage: AFLM and AFLW.
 */

import { Result } from "../../lib/result";
import { transformFryziggPlayerStats } from "../../transforms/fryzigg-player-stats";
import type { PlayerStatsQuery, SeasonPlayerStats } from "../../types";
import { FryziggClient } from "../fryzigg";
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
export class FryziggPlayerStatsSource implements PlayerStatsSource {
  readonly id = "fryzigg" as const;
  readonly coverage = FRYZIGG_PLAYER_STATS_COVERAGE;

  constructor(private readonly client: FryziggClient = new FryziggClient()) {}

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<SeasonPlayerStats, Error>> {
    const competition = query.competition ?? "AFLM";
    const result = await this.client.fetchPlayerStats(competition);
    if (!result.success) return result;
    const transformed = transformFryziggPlayerStats(result.data, {
      competition,
      season: query.season,
      round: query.round,
    });
    // Fryzigg is a single bulk download — there are no per-game fetches
    // that can partially fail, so failedMatchIds is always empty.
    return Result.map(transformed, (stats) => ({ stats, failedMatchIds: [] }));
  }
}
