/**
 * Public API for fetching fixture/schedule data.
 */

import { AflApiError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchItem } from "../lib/validation";
import { AflApiClient } from "../sources/afl-api";
import { toMatchStatus } from "../transforms/match-results";
import type { CompetitionCode, Fixture, SeasonRoundQuery } from "../types";

/** Map a raw match item to a Fixture domain object. */
function toFixture(
  item: MatchItem,
  season: number,
  fallbackRoundNumber: number,
  competition: CompetitionCode,
): Fixture {
  return {
    matchId: item.match.matchId,
    season,
    roundNumber: item.round?.roundNumber ?? fallbackRoundNumber,
    roundType: "HomeAndAway",
    date: new Date(item.match.utcStartTime),
    venue: item.venue?.name ?? "",
    homeTeam: normaliseTeamName(item.match.homeTeam.name),
    awayTeam: normaliseTeamName(item.match.awayTeam.name),
    status: toMatchStatus(item.match.status),
    competition,
  };
}

/**
 * Fetch fixture (schedule) data for a season.
 *
 * @param query - Source, season, optional round, and competition.
 * @returns Array of fixture entries.
 */
export async function fetchFixture(query: SeasonRoundQuery): Promise<Result<Fixture[], Error>> {
  const competition = query.competition ?? "AFLM";

  if (query.source !== "afl-api") {
    return err(new AflApiError("Fixture data is only available from the AFL API source."));
  }

  const client = new AflApiClient();

  const seasonResult = await client.resolveCompSeason(competition, query.season);
  if (!seasonResult.success) return seasonResult;

  if (query.round != null) {
    const itemsResult = await client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round);
    if (!itemsResult.success) return itemsResult;
    return ok(itemsResult.data.map((item) => toFixture(item, query.season, 0, competition)));
  }

  const roundsResult = await client.resolveRounds(seasonResult.data);
  if (!roundsResult.success) return roundsResult;

  const roundProviderIds = roundsResult.data
    .filter((r) => r.providerId)
    .map((r) => ({ providerId: r.providerId as string, roundNumber: r.roundNumber }));

  const roundResults = await Promise.all(
    roundProviderIds.map((r) => client.fetchRoundMatchItems(r.providerId)),
  );

  const fixtures: Fixture[] = [];
  for (let i = 0; i < roundResults.length; i++) {
    const result = roundResults[i];
    if (!result?.success) continue;
    const roundNumber = roundProviderIds[i]?.roundNumber ?? 0;
    for (const item of result.data) {
      fixtures.push(toFixture(item, query.season, roundNumber, competition));
    }
  }

  return ok(fixtures);
}
