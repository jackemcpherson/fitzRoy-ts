/**
 * Squiggle source adapters.
 *
 * Squiggle covers AFLM only, from 2012+. Other capabilities (Ladder)
 * declare their own coverage in their own classes.
 */

import { ok, type Result } from "../../lib/result";
import {
  transformSquiggleGamesToFixture,
  transformSquiggleStandings,
} from "../../transforms/squiggle";
import type { Ladder, LadderQuery, Match, MatchQuery } from "../../types";
import { SquiggleClient } from "../squiggle";
import type { LadderSource, MatchSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const SQUIGGLE_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2012 }]]);
const SQUIGGLE_LADDER_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2012 }]]);

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

/** Squiggle as a LadderSource (AFLM only, 2012+). */
export class SquiggleLadderSource implements LadderSource {
  readonly id = "squiggle" as const;
  readonly coverage = SQUIGGLE_LADDER_COVERAGE;

  constructor(private readonly client: SquiggleClient = new SquiggleClient()) {}

  async fetchLadder(query: LadderQuery): Promise<Result<Ladder, Error>> {
    const competition = query.competition ?? "AFLM";
    const result = await this.client.fetchStandings(query.season, query.round ?? undefined);
    if (!result.success) return result;
    return ok({
      season: query.season,
      roundNumber: query.round ?? null,
      entries: transformSquiggleStandings(result.data.standings),
      competition,
    });
  }
}
