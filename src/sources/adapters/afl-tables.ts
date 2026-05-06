/**
 * AFL Tables source adapters.
 *
 * AFL Tables is AFLM-only. Match results go back to 1897; player stats
 * start ~1965. Other capabilities (TeamStats, Ladder via compute) declare
 * their own coverage in their own classes.
 */

import { ok, type Result } from "../../lib/result";
import type { Match, MatchQuery } from "../../types";
import { AflTablesClient } from "../afl-tables";
import type { MatchSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const AFL_TABLES_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);

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
