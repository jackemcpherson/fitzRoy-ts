/**
 * Public API for fetching fixture/schedule data.
 */

import { AflApiError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import { AflApiClient } from "../sources/afl-api";
import type { Fixture, SeasonRoundQuery } from "../types";

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

  const compResult = await client.resolveCompetitionId(competition);
  if (!compResult.success) return compResult;

  const seasonResult = await client.resolveSeasonId(compResult.data, query.season);
  if (!seasonResult.success) return seasonResult;

  if (query.round != null) {
    const itemsResult = await client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round);
    if (!itemsResult.success) return itemsResult;

    return ok(
      itemsResult.data.map((item) => ({
        matchId: item.match.matchId,
        season: query.season,
        roundNumber: item.round?.roundNumber ?? 0,
        roundType: "HomeAndAway" as const,
        date: new Date(item.match.utcStartTime),
        venue: item.venue?.name ?? "",
        homeTeam: normaliseTeamName(item.match.homeTeam.name),
        awayTeam: normaliseTeamName(item.match.awayTeam.name),
        status: item.match.status === "UPCOMING" ? "Upcoming" : "Complete",
        competition,
      })),
    );
  }

  // Fetch all rounds for the full season fixture
  const roundsResult = await client.resolveRounds(seasonResult.data);
  if (!roundsResult.success) return roundsResult;

  const fixtures: Fixture[] = [];
  for (const round of roundsResult.data) {
    if (!round.providerId) continue;

    const itemsResult = await client.fetchRoundMatchItems(round.providerId);
    if (!itemsResult.success) return itemsResult;

    for (const item of itemsResult.data) {
      fixtures.push({
        matchId: item.match.matchId,
        season: query.season,
        roundNumber: item.round?.roundNumber ?? round.roundNumber,
        roundType: "HomeAndAway",
        date: new Date(item.match.utcStartTime),
        venue: item.venue?.name ?? "",
        homeTeam: normaliseTeamName(item.match.homeTeam.name),
        awayTeam: normaliseTeamName(item.match.awayTeam.name),
        status: item.match.status === "UPCOMING" ? "Upcoming" : "Complete",
        competition,
      });
    }
  }

  return ok(fixtures);
}
