/**
 * Pure transforms for Squiggle API data → domain types.
 */

import type { SquiggleGame, SquiggleStanding } from "../lib/squiggle-validation";
import { normaliseTeamName } from "../lib/team-mapping";
import { normaliseVenueName } from "../lib/venue-mapping";
import type { Fixture, LadderEntry, MatchResult, MatchStatus } from "../types";
import { inferRoundType } from "./match-results";

/** Convert Squiggle completion percentage to MatchStatus. */
function toMatchStatus(complete: number): MatchStatus {
  if (complete === 100) return "Complete";
  if (complete > 0) return "Live";
  return "Upcoming";
}

/**
 * Transform Squiggle games into MatchResult objects.
 *
 * Only includes games that are complete (complete === 100).
 */
export function transformSquiggleGamesToResults(
  games: readonly SquiggleGame[],
  season: number,
): MatchResult[] {
  return games
    .filter((g) => g.complete === 100)
    .map((g) => ({
      matchId: `SQ_${g.id}`,
      season,
      roundNumber: g.round,
      roundType: inferRoundType(g.roundname),
      date: new Date(g.unixtime * 1000),
      venue: normaliseVenueName(g.venue),
      homeTeam: normaliseTeamName(g.hteam),
      awayTeam: normaliseTeamName(g.ateam),
      homeGoals: g.hgoals ?? 0,
      homeBehinds: g.hbehinds ?? 0,
      homePoints: g.hscore ?? 0,
      awayGoals: g.agoals ?? 0,
      awayBehinds: g.abehinds ?? 0,
      awayPoints: g.ascore ?? 0,
      margin: (g.hscore ?? 0) - (g.ascore ?? 0),
      q1Home: null,
      q2Home: null,
      q3Home: null,
      q4Home: null,
      q1Away: null,
      q2Away: null,
      q3Away: null,
      q4Away: null,
      status: "Complete" as const,
      attendance: null,
      venueState: null,
      venueTimezone: g.tz || null,
      homeRushedBehinds: null,
      awayRushedBehinds: null,
      homeMinutesInFront: null,
      awayMinutesInFront: null,
      source: "squiggle" as const,
      competition: "AFLM" as const,
    }));
}

/**
 * Transform Squiggle games into Fixture objects.
 *
 * Includes all games regardless of completion status.
 */
export function transformSquiggleGamesToFixture(
  games: readonly SquiggleGame[],
  season: number,
): Fixture[] {
  return games.map((g) => ({
    matchId: `SQ_${g.id}`,
    season,
    roundNumber: g.round,
    roundType: inferRoundType(g.roundname),
    date: new Date(g.unixtime * 1000),
    venue: g.venue,
    homeTeam: normaliseTeamName(g.hteam),
    awayTeam: normaliseTeamName(g.ateam),
    status: toMatchStatus(g.complete),
    competition: "AFLM" as const,
  }));
}

/**
 * Transform Squiggle standings into LadderEntry objects.
 */
export function transformSquiggleStandings(standings: readonly SquiggleStanding[]): LadderEntry[] {
  return standings.map((s) => ({
    position: s.rank,
    team: normaliseTeamName(s.name),
    played: s.played,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    pointsFor: s.for,
    pointsAgainst: s.against,
    percentage: s.percentage,
    premiershipsPoints: s.pts,
    form: null,
  }));
}
