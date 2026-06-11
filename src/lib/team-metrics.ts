/**
 * Shared factory for canonical {@link TeamMetricSet} shapes.
 */

import type { TeamMetricSet } from "../types";

/**
 * Mutable companion to {@link TeamMetricSet} for incremental construction.
 * Parsers fill fields in as they walk a stats table, then hand the finished
 * set off as a (readonly) `TeamMetricSet` — no casts required.
 */
export type MutableTeamMetricSet = {
  -readonly [K in keyof TeamMetricSet]: TeamMetricSet[K];
};

/** Build a fully-nullable TeamMetricSet — caller fills in the fields a source supplies. */
export function emptyMetricSet(): MutableTeamMetricSet {
  return {
    kicks: null,
    handballs: null,
    disposals: null,
    marks: null,
    goals: null,
    behinds: null,
    goalAssists: null,
    tackles: null,
    hitouts: null,
    freesFor: null,
    freesAgainst: null,
    clearances: null,
    clangers: null,
    inside50s: null,
    rebound50s: null,
    contestedPossessions: null,
    uncontestedPossessions: null,
    contestedMarks: null,
    marksInside50: null,
    onePercenters: null,
    bounces: null,
    brownlowVotes: null,
    fantasyPoints: null,
    supercoachPoints: null,
  };
}
