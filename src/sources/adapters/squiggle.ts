import { seasonYear } from "../../lib/seasons";
/**
 * Squiggle source adapters.
 *
 * Squiggle covers AFLM only, from 2012+. Other capabilities (Ladder)
 * declare their own coverage in their own classes.
 */

import { Effect } from "effect";
import {
  transformSquiggleGamesToFixture,
  transformSquiggleStandings,
} from "../../transforms/squiggle";
import { Squiggle } from "../squiggle";
import type { LadderSource, MatchSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const SQUIGGLE_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2012 }]]);

const SQUIGGLE_LADDER_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2012 }]]);

/** Squiggle as a MatchSource (AFLM only, 2012+). */
export const squiggleMatchSource: Effect.Effect<MatchSource, never, Squiggle> = Effect.gen(
  function* () {
    const client = yield* Squiggle;

    return {
      id: "squiggle",
      coverage: SQUIGGLE_MATCH_COVERAGE,
      fetchMatches: (query) => {
        // Only constrain the API when the caller wants completed games:
        // hardcoding complete=100 made Upcoming/Live queries silently return
        // []. For other statuses fetch everything and let the API layer's
        // filterMatches do the filtering.
        const complete = query.status === "Complete" ? 100 : undefined;
        const season = seasonYear(query.season);

        return client
          .fetchGames(season, query.round ?? undefined, complete)
          .pipe(Effect.map((data) => transformSquiggleGamesToFixture(data.games, season)));
      },
    };
  },
);

/** Squiggle as a LadderSource (AFLM only, 2012+). */
export const squiggleLadderSource: Effect.Effect<LadderSource, never, Squiggle> = Effect.gen(
  function* () {
    const client = yield* Squiggle;

    return {
      id: "squiggle",
      coverage: SQUIGGLE_LADDER_COVERAGE,
      fetchLadder: (query) => {
        const competition = query.competition ?? "AFLM";
        const season = seasonYear(query.season);

        return client.fetchStandings(season, query.round ?? undefined).pipe(
          Effect.map((data) => ({
            season,
            roundNumber: query.round ?? null,
            entries: transformSquiggleStandings(data.standings),
            competition,
            source: "squiggle" as const,
            // Squiggle's standings endpoint doesn't expose the most recent
            // completed match's id (#119); leave null.
            asOfMatch: null,
          })),
        );
      },
    };
  },
);
