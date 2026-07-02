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
import type { PlayerStatsSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

// Fryzigg distributes static RDS dumps that update infrequently and on
// independent schedules per competition. Caps prevent empty/stale-row returns
// for seasons not yet in a dump — dispatch suggests --source afl-api instead
// (#89). Update these after each AFL season by checking Last-Modified:
//
//   curl -sI http://www.fryziggafl.net/static/fryziggafl.rds | grep -i last-modified
//   curl -sI http://www.fryziggafl.net/static/aflw_player_stats.rds | grep -i last-modified
//
// A Last-Modified date beyond the current cap's season Grand Final means a new
// dump is available. Run `bun run scripts/probe-fryzigg.ts` to confirm the
// new max season, then bump the relevant constant below.
//
// NOTE: the AFLW dump has not been updated since January 2022 (last verified
// 2026-07-02 via probe). FRYZIGG_AFLW_LATEST_SNAPSHOT should NOT be bumped
// until the upstream dump resumes — it is deliberately set to the actual max
// season present in the dump, not the current year.
const FRYZIGG_AFLM_LATEST_SNAPSHOT = 2025; // dump updated Sep 2025; data through 2025-09-27
const FRYZIGG_AFLW_LATEST_SNAPSHOT = 2022; // dump last updated Jan 2022; appears abandoned

const FRYZIGG_PLAYER_STATS_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 2012, maxSeason: FRYZIGG_AFLM_LATEST_SNAPSHOT }],
  ["AFLW", { minSeason: 2017, maxSeason: FRYZIGG_AFLW_LATEST_SNAPSHOT }],
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
