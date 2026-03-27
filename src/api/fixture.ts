/**
 * Public API for fetching fixture/schedule data.
 */

import { batchedMap } from "../lib/concurrency";
import { aflwUnsupportedError, UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchItem } from "../lib/validation";
import { AflApiClient } from "../sources/afl-api";
import { FootyWireClient } from "../sources/footywire";
import { SquiggleClient } from "../sources/squiggle";
import { inferRoundType, toMatchStatus } from "../transforms/match-results";
import { transformSquiggleGamesToFixture } from "../transforms/squiggle";
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
    roundType: inferRoundType(item.round?.name ?? ""),
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
        "Fixture data is only available from the AFL API, FootyWire, or Squiggle sources.",
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
