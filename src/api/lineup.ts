/**
 * Public API for fetching match lineup/roster data.
 */

import { batchedMap } from "../lib/concurrency";
import { AflApiError, UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { AflApiClient } from "../sources/afl-api";
import { transformMatchRoster } from "../transforms/lineup";
import type { Lineup, LineupQuery } from "../types";

/**
 * Fetch match lineup data for a round or specific match.
 *
 * When `matchId` is provided, returns a single-element array for that match.
 * When omitted, returns lineups for all matches in the round.
 *
 * @param query - Source, season, round, optional matchId, and competition.
 * @returns Array of lineups.
 */
export async function fetchLineup(query: LineupQuery): Promise<Result<Lineup[], Error>> {
  const competition = query.competition ?? "AFLM";

  if (query.source !== "afl-api") {
    return err(
      new UnsupportedSourceError(
        "Lineup data is only available from the AFL API source.",
        query.source,
      ),
    );
  }

  const client = new AflApiClient();

  if (query.matchId) {
    const rosterResult = await client.fetchMatchRoster(query.matchId);
    if (!rosterResult.success) return rosterResult;
    return ok([transformMatchRoster(rosterResult.data, query.season, query.round, competition)]);
  }

  const seasonResult = await client.resolveCompSeason(competition, query.season);
  if (!seasonResult.success) return seasonResult;

  const matchItems = await client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round);
  if (!matchItems.success) return matchItems;

  if (matchItems.data.length === 0) {
    return err(new AflApiError(`No matches found for round ${query.round}`));
  }

  const rosterResults = await batchedMap(matchItems.data, (item) =>
    client.fetchMatchRoster(item.match.matchId),
  );

  const lineups: Lineup[] = [];
  for (const rosterResult of rosterResults) {
    if (!rosterResult.success) return rosterResult;
    lineups.push(transformMatchRoster(rosterResult.data, query.season, query.round, competition));
  }

  return ok(lineups);
}
