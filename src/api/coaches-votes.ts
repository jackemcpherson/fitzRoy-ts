/**
 * Public API for fetching AFLCA coaches votes.
 *
 * Scrapes data from the AFL Coaches Association website.
 */

import { ScrapeError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import { AflCoachesClient } from "../sources/afl-coaches";
import type { CoachesVote, CoachesVoteQuery } from "../types";

/**
 * Fetch AFLCA coaches votes for a season (and optionally a specific round/team).
 *
 * Scrapes the AFL Coaches Association website for vote data. Available from
 * approximately 2006 onwards for AFLM and 2018 onwards for AFLW.
 *
 * @param query - Season, optional round, competition, and team filter.
 * @returns Array of coaches vote records.
 *
 * @example
 * ```ts
 * const result = await fetchCoachesVotes({ season: 2024, competition: "AFLM" });
 * if (result.success) {
 *   console.log(result.data); // CoachesVote[]
 * }
 * ```
 */
export async function fetchCoachesVotes(
  query: CoachesVoteQuery,
): Promise<Result<CoachesVote[], Error>> {
  const competition = query.competition ?? "AFLM";

  if (query.season < 2006) {
    return err(new ScrapeError("No coaches votes data available before 2006", "afl-coaches"));
  }

  if (competition === "AFLW" && query.season < 2018) {
    return err(new ScrapeError("No AFLW coaches votes data available before 2018", "afl-coaches"));
  }

  const client = new AflCoachesClient();

  let result: Result<CoachesVote[], ScrapeError>;

  if (query.round != null) {
    // Fetch a specific round
    const isFinals = query.round >= 24 && query.season >= 2018;
    result = await client.scrapeRoundVotes(query.season, query.round, competition, isFinals);
  } else {
    // Fetch all rounds for the season
    result = await client.fetchSeasonVotes(query.season, competition);
  }

  if (!result.success) {
    return result;
  }

  let votes = result.data;

  // Filter by team if specified
  if (query.team != null) {
    const normalisedTeam = normaliseTeamName(query.team);
    votes = votes.filter(
      (v) =>
        normaliseTeamName(v.homeTeam) === normalisedTeam ||
        normaliseTeamName(v.awayTeam) === normalisedTeam,
    );

    if (votes.length === 0) {
      return ok([]);
    }
  }

  return ok(votes);
}
