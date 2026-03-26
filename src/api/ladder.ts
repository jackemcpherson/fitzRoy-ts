/**
 * Public API for fetching ladder/standings data.
 */

import { UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { AflApiClient } from "../sources/afl-api";
import { transformLadderEntries } from "../transforms/ladder";
import type { Ladder, LadderQuery } from "../types";

/**
 * Fetch ladder standings for a season (optionally for a specific round).
 *
 * @param query - Source, season, optional round, and competition.
 * @returns Ladder standings.
 *
 * @example
 * ```ts
 * const result = await fetchLadder({ source: "afl-api", season: 2024, round: 10 });
 * ```
 */
export async function fetchLadder(query: LadderQuery): Promise<Result<Ladder, Error>> {
  const competition = query.competition ?? "AFLM";

  if (query.source !== "afl-api") {
    return err(
      new UnsupportedSourceError(
        "Ladder data is only available from the AFL API source.",
        query.source,
      ),
    );
  }

  const client = new AflApiClient();

  const seasonResult = await client.resolveCompSeason(competition, query.season);
  if (!seasonResult.success) return seasonResult;

  let roundId: number | undefined;
  if (query.round != null) {
    const roundsResult = await client.resolveRounds(seasonResult.data);
    if (!roundsResult.success) return roundsResult;
    const round = roundsResult.data.find((r) => r.roundNumber === query.round);
    if (round) {
      roundId = round.id;
    }
  }

  const ladderResult = await client.fetchLadder(seasonResult.data, roundId);
  if (!ladderResult.success) return ladderResult;

  const firstLadder = ladderResult.data.ladders[0];
  const entries = firstLadder ? transformLadderEntries(firstLadder.entries) : [];

  return ok({
    season: query.season,
    roundNumber: ladderResult.data.round?.roundNumber ?? null,
    entries,
    competition,
  });
}
