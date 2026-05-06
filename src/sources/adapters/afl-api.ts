/**
 * AFL API source adapters.
 *
 * One class per capability (Match, PlayerStats, Squad, Lineup, Ladder)
 * because each capability has its own coverage map. AFL API supports the
 * same season ranges across all of its operations, but per-capability
 * classes keep the design uniform with sources whose coverage *does* vary
 * per operation (e.g., AFL Tables: matches from 1897, stats from ~1965).
 */

import { ok, type Result } from "../../lib/result";
import { transformMatchItems } from "../../transforms/match-results";
import type { Match, MatchQuery } from "../../types";
import { AflApiClient } from "../afl-api";
import type { MatchSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

/** Per-capability coverage shared by every AFL API capability. */
const AFL_API_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 2012 }],
  ["AFLW", { minSeason: 2017 }],
  ["VFL", { minSeason: 2021 }],
  ["VFLW", { minSeason: 2021 }],
]);

/** AFL API as a MatchSource. */
export class AflApiMatchSource implements MatchSource {
  readonly id = "afl-api" as const;
  readonly coverage = AFL_API_COVERAGE;

  constructor(private readonly client: AflApiClient = new AflApiClient()) {}

  async fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
    const competition = query.competition ?? "AFLM";
    const seasonResult = await this.client.resolveCompSeason(competition, query.season);
    if (!seasonResult.success) return seasonResult;

    const includeUpcoming = query.status !== "Complete";
    const itemsResult =
      query.round != null
        ? await this.client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round)
        : await this.client.fetchSeasonMatchItems(seasonResult.data, { includeUpcoming });
    if (!itemsResult.success) return itemsResult;
    return ok(transformMatchItems(itemsResult.data, query.season, competition));
  }
}
