/**
 * FootyWire source adapters.
 *
 * FootyWire is AFLM-only (no AFLW or VFL coverage). Each capability has
 * its own class so per-capability coverage stays accurate.
 */

import { ok, type Result } from "../../lib/result";
import type { Match, MatchQuery } from "../../types";
import { FootyWireClient } from "../footywire";
import type { MatchSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const FOOTYWIRE_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);

/** FootyWire as a MatchSource (AFLM only, ~2010+). */
export class FootyWireMatchSource implements MatchSource {
  readonly id = "footywire" as const;
  readonly coverage = FOOTYWIRE_MATCH_COVERAGE;

  constructor(private readonly client: FootyWireClient = new FootyWireClient()) {}

  async fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
    // fetchSeasonFixture returns ALL matches (any status). fetchSeasonResults
    // returns only completed. Use the broader call so the api-layer status
    // filter applies uniformly across sources.
    const result = await this.client.fetchSeasonFixture(query.season);
    if (!result.success) return result;
    const filtered =
      query.round != null ? result.data.filter((m) => m.roundNumber === query.round) : result.data;
    return ok(filtered);
  }
}
