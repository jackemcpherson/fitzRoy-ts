/**
 * AFL Tables source adapters.
 *
 * AFL Tables is AFLM-only. Match results go back to 1897; player stats
 * start ~1965. Other capabilities (TeamStats, Ladder via compute) declare
 * their own coverage in their own classes.
 */

import { ok, type Result } from "../../lib/result";
import type { Match, MatchQuery, PlayerStats, PlayerStatsQuery } from "../../types";
import { AflTablesClient } from "../afl-tables";
import type { MatchSource, PlayerStatsSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const AFL_TABLES_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);
const AFL_TABLES_PLAYER_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1965 }]]);

/** AFL Tables as a MatchSource (AFLM only, 1897+). */
export class AflTablesMatchSource implements MatchSource {
  readonly id = "afl-tables" as const;
  readonly coverage = AFL_TABLES_MATCH_COVERAGE;

  constructor(private readonly client: AflTablesClient = new AflTablesClient()) {}

  async fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
    const result = await this.client.fetchSeasonResults(query.season);
    if (!result.success) return result;
    const filtered =
      query.round != null ? result.data.filter((m) => m.roundNumber === query.round) : result.data;
    return ok(filtered);
  }
}

/** AFL Tables as a PlayerStatsSource (AFLM only, ~1965+). */
export class AflTablesPlayerStatsSource implements PlayerStatsSource {
  readonly id = "afl-tables" as const;
  readonly coverage = AFL_TABLES_PLAYER_STATS_COVERAGE;

  constructor(private readonly client: AflTablesClient = new AflTablesClient()) {}

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<PlayerStats[], Error>> {
    const result = await this.client.fetchSeasonPlayerStats(query.season);
    if (!result.success) return result;
    if (query.round != null) {
      return ok(result.data.filter((s) => s.roundNumber === query.round));
    }
    return result;
  }
}
