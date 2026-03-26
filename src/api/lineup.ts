/**
 * Public API for fetching match lineup/roster data.
 */

import { AflApiError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { AflApiClient } from "../sources/afl-api";
import { transformMatchRoster } from "../transforms/lineup";
import type { Lineup, LineupQuery } from "../types";

/**
 * Fetch match lineup data.
 *
 * @param query - Source, season, round, optional matchId, and competition.
 * @returns Lineup for the specified match.
 */
export async function fetchLineup(query: LineupQuery): Promise<Result<Lineup, Error>> {
  const competition = query.competition ?? "AFLM";

  if (query.source !== "afl-api") {
    return err(new AflApiError("Lineup data is only available from the AFL API source."));
  }

  const client = new AflApiClient();

  if (query.matchId) {
    const rosterResult = await client.fetchMatchRoster(query.matchId);
    if (!rosterResult.success) return rosterResult;
    return ok(transformMatchRoster(rosterResult.data, query.season, query.round, competition));
  }

  const seasonResult = await client.resolveCompSeason(competition, query.season);
  if (!seasonResult.success) return seasonResult;

  const matchItems = await client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round);
  if (!matchItems.success) return matchItems;

  const firstMatch = matchItems.data[0];
  if (!firstMatch) {
    return err(new AflApiError(`No matches found for round ${query.round}`));
  }

  const rosterResult = await client.fetchMatchRoster(firstMatch.match.matchId);
  if (!rosterResult.success) return rosterResult;
  return ok(transformMatchRoster(rosterResult.data, query.season, query.round, competition));
}
