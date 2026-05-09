/**
 * Fryzigg source adapter.
 *
 * Fryzigg distributes static RDS dumps. Only PlayerStats is published —
 * no match results, ladders, or squads. Coverage: AFLM and AFLW.
 */

import type { Result } from "../../lib/result";
import { transformFryziggPlayerStats } from "../../transforms/fryzigg-player-stats";
import type { PlayerStats, PlayerStatsQuery } from "../../types";
import { FryziggClient } from "../fryzigg";
import type { PlayerStatsSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

// Fryzigg is a static RDS dump that updates infrequently. Cap the coverage
// at the latest snapshot year so dispatch can suggest --source afl-api for
// current-season requests instead of returning empty/stale rows (#89).
const FRYZIGG_LATEST_SNAPSHOT = 2024;

const FRYZIGG_PLAYER_STATS_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 2012, maxSeason: FRYZIGG_LATEST_SNAPSHOT }],
  ["AFLW", { minSeason: 2017, maxSeason: FRYZIGG_LATEST_SNAPSHOT }],
]);

/** Fryzigg as a PlayerStatsSource (AFLM and AFLW only). */
export class FryziggPlayerStatsSource implements PlayerStatsSource {
  readonly id = "fryzigg" as const;
  readonly coverage = FRYZIGG_PLAYER_STATS_COVERAGE;

  constructor(private readonly client: FryziggClient = new FryziggClient()) {}

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<PlayerStats[], Error>> {
    const competition = query.competition ?? "AFLM";
    const result = await this.client.fetchPlayerStats(competition);
    if (!result.success) return result;
    return transformFryziggPlayerStats(result.data, {
      competition,
      season: query.season,
      round: query.round,
    });
  }
}
