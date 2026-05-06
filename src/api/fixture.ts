/**
 * Public API for fetching fixture/schedule data.
 */

import { batchedMap } from "../lib/concurrency";
import { parseDate } from "../lib/date-utils";
import { aflwUnsupportedError, UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchItem } from "../lib/validation";
import { normaliseVenueName } from "../lib/venue-mapping";
import { AflApiClient } from "../sources/afl-api";
import { FootyWireClient } from "../sources/footywire";
import { SquiggleClient } from "../sources/squiggle";
import { inferRoundType, toMatchStatus } from "../transforms/match-results";
import { transformSquiggleGamesToFixture } from "../transforms/squiggle";
import type { CompetitionCode, Match, SeasonRoundQuery } from "../types";

/** Map a raw match item to a Match domain object (no scores yet — fixture form). */
function toFixture(
  item: MatchItem,
  season: number,
  fallbackRoundNumber: number,
  competition: CompetitionCode,
): Match {
  return {
    matchId: item.match.matchId,
    season,
    roundNumber: item.round?.roundNumber ?? fallbackRoundNumber,
    roundType: inferRoundType(item.round?.name ?? ""),
    roundName: item.round?.name ?? null,
    date: parseDate(item.match.utcStartTime) ?? new Date(item.match.utcStartTime),
    venue: normaliseVenueName(item.venue?.name ?? ""),
    homeTeam: normaliseTeamName(item.match.homeTeam.name),
    awayTeam: normaliseTeamName(item.match.awayTeam.name),
    homeGoals: null,
    homeBehinds: null,
    homePoints: null,
    awayGoals: null,
    awayBehinds: null,
    awayPoints: null,
    margin: null,
    q1Home: null,
    q2Home: null,
    q3Home: null,
    q4Home: null,
    q1Away: null,
    q2Away: null,
    q3Away: null,
    q4Away: null,
    status: toMatchStatus(item.match.status),
    attendance: null,
    weatherTempCelsius: null,
    weatherType: null,
    roundCode: null,
    venueState: null,
    venueTimezone: null,
    homeRushedBehinds: null,
    awayRushedBehinds: null,
    homeMinutesInFront: null,
    awayMinutesInFront: null,
    source: "afl-api",
    competition,
  };
}

/**
 * Fetch fixture (schedule) data for a season.
 *
 * @param query - Source, season, optional round, and competition.
 * @returns Array of fixture entries.
 */
export async function fetchFixture(query: SeasonRoundQuery): Promise<Result<Match[], Error>> {
  const competition = query.competition ?? "AFLM";

  if (query.source === "squiggle") {
    if (competition === "AFLW") return err(aflwUnsupportedError("squiggle"));
    const client = new SquiggleClient();
    const result = await client.fetchGames(query.season, query.round ?? undefined);
    if (!result.success) return result;
    return ok(transformSquiggleGamesToFixture(result.data.games, query.season));
  }

  if (query.source === "footywire") {
    if (competition === "AFLW") return err(aflwUnsupportedError("footywire"));
    const fwClient = new FootyWireClient();
    const result = await fwClient.fetchSeasonFixture(query.season);
    if (!result.success) return result;

    if (query.round != null) {
      return ok(result.data.filter((f) => f.roundNumber === query.round));
    }
    return result;
  }

  if (query.source !== "afl-api") {
    return err(
      new UnsupportedSourceError(
        "Match data is only available from the AFL API, FootyWire, or Squiggle sources.",
        query.source,
      ),
    );
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

  const roundProviderIds = roundsResult.data.flatMap((r) =>
    r.providerId ? [{ providerId: r.providerId, roundNumber: r.roundNumber }] : [],
  );

  const roundResults = await batchedMap(roundProviderIds, (r) =>
    client.fetchRoundMatchItems(r.providerId),
  );

  const fixtures: Match[] = [];
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
