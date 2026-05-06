/**
 * Squiggle source adapters.
 *
 * Squiggle covers AFLM only, from 2012+. Other capabilities (Ladder)
 * declare their own coverage in their own classes.
 */

import { ok, type Result } from "../../lib/result";
import { transformSquiggleGamesToFixture } from "../../transforms/squiggle";
import type { Match, MatchQuery } from "../../types";
import { SquiggleClient } from "../squiggle";
import type { MatchSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const SQUIGGLE_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2012 }]]);

/** Squiggle as a MatchSource (AFLM only, 2012+). */
export class SquiggleMatchSource implements MatchSource {
  readonly id = "squiggle" as const;
  readonly coverage = SQUIGGLE_MATCH_COVERAGE;

  constructor(private readonly client: SquiggleClient = new SquiggleClient()) {}

  async fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
    const result = await this.client.fetchGames(query.season, query.round ?? undefined, 100);
    if (!result.success) return result;
    return ok(transformSquiggleGamesToFixture(result.data.games, query.season));
  }
}
