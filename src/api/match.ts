/**
 * Public API for fetching matches across data sources.
 *
 * Subsumes the old `fetchMatchResults` and `fetchFixture`. Use the `status`
 * filter to scope to upcoming or completed matches; omit it to get all.
 */

import { aflwUnsupportedError, UnsupportedSourceError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import { AflApiClient } from "../sources/afl-api";
import { AflTablesClient } from "../sources/afl-tables";
import { FootyWireClient } from "../sources/footywire";
import { SquiggleClient } from "../sources/squiggle";
import { transformMatchItems } from "../transforms/match-results";
import { transformSquiggleGamesToFixture } from "../transforms/squiggle";
import type { Match, MatchQuery } from "../types";

/**
 * Fetch matches matching the query.
 *
 * @example
 * ```ts
 * // All AFLM matches in 2025 round 3
 * await fetchMatches({ source: "afl-api", season: 2025, round: 3 });
 *
 * // Only upcoming matches (a "fixture" view)
 * await fetchMatches({ source: "afl-api", season: 2025, status: "Upcoming" });
 *
 * // One specific match by id
 * await fetchMatches({ source: "afl-api", season: 2025, matchId: "CD_M..." });
 * ```
 */
export async function fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
  const competition = query.competition ?? "AFLM";
  const fetched = await fetchAll(query, competition);
  if (!fetched.success) return fetched;
  return ok(applyClientFilters(fetched.data, query));
}

/** Apply matchId/team/status filters that the source didn't already apply. */
function applyClientFilters(matches: readonly Match[], query: MatchQuery): Match[] {
  let filtered: readonly Match[] = matches;
  if (query.matchId !== undefined) {
    filtered = filtered.filter((m) => m.matchId === query.matchId);
  }
  if (query.team !== undefined) {
    const target = normaliseTeamName(query.team);
    filtered = filtered.filter((m) => m.homeTeam === target || m.awayTeam === target);
  }
  if (query.status !== undefined) {
    filtered = filtered.filter((m) => m.status === query.status);
  }
  return [...filtered];
}

/** Fetch all matches from the source for the requested season ± round. */
async function fetchAll(
  query: MatchQuery,
  competition: "AFLM" | "AFLW" | "VFL" | "VFLW",
): Promise<Result<Match[], Error>> {
  switch (query.source) {
    case "afl-api": {
      const client = new AflApiClient();
      const seasonResult = await client.resolveCompSeason(competition, query.season);
      if (!seasonResult.success) return seasonResult;

      const includeUpcoming = query.status !== "Complete";
      const itemsResult =
        query.round != null
          ? await client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round)
          : await client.fetchSeasonMatchItems(seasonResult.data, { includeUpcoming });
      if (!itemsResult.success) return itemsResult;
      return ok(transformMatchItems(itemsResult.data, query.season, competition));
    }

    case "footywire": {
      if (competition !== "AFLM") return err(aflwUnsupportedError("footywire"));
      const client = new FootyWireClient();
      // fetchSeasonFixture returns all matches (any status). fetchSeasonResults
      // returns only completed. Use the broader call so the client filters apply.
      const result = await client.fetchSeasonFixture(query.season);
      if (!result.success) return result;
      const filtered =
        query.round != null
          ? result.data.filter((m) => m.roundNumber === query.round)
          : result.data;
      return ok(filtered);
    }

    case "afl-tables": {
      if (competition !== "AFLM") return err(aflwUnsupportedError("afl-tables"));
      const client = new AflTablesClient();
      const result = await client.fetchSeasonResults(query.season);
      if (!result.success) return result;
      const filtered =
        query.round != null
          ? result.data.filter((m) => m.roundNumber === query.round)
          : result.data;
      return ok(filtered);
    }

    case "squiggle": {
      if (competition !== "AFLM") return err(aflwUnsupportedError("squiggle"));
      const client = new SquiggleClient();
      const result = await client.fetchGames(query.season, query.round ?? undefined, 100);
      if (!result.success) return result;
      return ok(transformSquiggleGamesToFixture(result.data.games, query.season));
    }

    case "fryzigg":
      return err(new UnsupportedSourceError("Fryzigg does not provide match data", query.source));

    default:
      return err(new UnsupportedSourceError(`Unsupported source: ${query.source}`, query.source));
  }
}
