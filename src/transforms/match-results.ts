/**
 * Pure transforms for flattening raw AFL API match items into typed MatchResult objects.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchItem, PeriodScore } from "../lib/validation";
import { normaliseVenueName } from "../lib/venue-mapping";
import type {
  CompetitionCode,
  DataSource,
  MatchResult,
  MatchStatus,
  QuarterScore,
  RoundType,
} from "../types";

/** Finals round name patterns. */
const FINALS_PATTERN = /final|elimination|qualifying|preliminary|semi|grand/i;

/** Infer RoundType from a round name string. */
export function inferRoundType(roundName: string): RoundType {
  return FINALS_PATTERN.test(roundName) ? "Finals" : "HomeAndAway";
}

/**
 * Map a finals header to a round number offset from the last home-and-away round.
 *
 * AFL convention: QF/EF = +1, SF = +2, PF = +3, GF = +4.
 *
 * @param headerText - The round header text (e.g. "Qualifying Final").
 * @param lastHARound - The last home-and-away round number.
 * @returns The assigned round number for this finals week.
 */
export function finalsRoundNumber(headerText: string, lastHARound: number): number {
  const lower = headerText.toLowerCase();
  if (lower.includes("qualifying") || lower.includes("elimination")) return lastHARound + 1;
  if (lower.includes("semi")) return lastHARound + 2;
  if (lower.includes("preliminary")) return lastHARound + 3;
  if (lower.includes("grand")) return lastHARound + 4;
  // Default: first finals week
  return lastHARound + 1;
}

/** Map raw API status strings to domain MatchStatus. */
export function toMatchStatus(raw: string): MatchStatus {
  switch (raw) {
    case "CONCLUDED":
    case "COMPLETE":
      return "Complete";
    case "LIVE":
    case "IN_PROGRESS":
      return "Live";
    case "UPCOMING":
    case "SCHEDULED":
      return "Upcoming";
    case "POSTPONED":
      return "Postponed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Complete";
  }
}

/** Extract a QuarterScore from a period score entry. */
function toQuarterScore(period: PeriodScore): QuarterScore {
  return {
    goals: period.score.goals,
    behinds: period.score.behinds,
    points: period.score.totalScore,
  };
}

/** Find a specific quarter's period score from the array. */
function findPeriod(
  periods: readonly PeriodScore[] | undefined,
  quarter: number,
): QuarterScore | null {
  if (!periods) return null;
  const period = periods.find((p) => p.periodNumber === quarter);
  return period ? toQuarterScore(period) : null;
}

/**
 * Transform raw AFL API match items into typed MatchResult objects.
 *
 * @param items - Raw match items from the /cfs/ endpoint.
 * @param season - The season year for these matches.
 * @param competition - The competition code.
 * @returns Flattened, normalised MatchResult array.
 */
export function transformMatchItems(
  items: readonly MatchItem[],
  season: number,
  competition: CompetitionCode,
  source: DataSource = "afl-api",
): MatchResult[] {
  return items.map((item) => {
    const homeScore = item.score?.homeTeamScore;
    const awayScore = item.score?.awayTeamScore;

    const homePoints = homeScore?.matchScore.totalScore ?? 0;
    const awayPoints = awayScore?.matchScore.totalScore ?? 0;

    return {
      matchId: item.match.matchId,
      season,
      roundNumber: item.round?.roundNumber ?? 0,
      roundType: inferRoundType(item.round?.name ?? ""),
      roundName: item.round?.name ?? null,
      date: new Date(item.match.utcStartTime),
      venue: item.venue?.name ? normaliseVenueName(item.venue.name) : "",
      homeTeam: normaliseTeamName(item.match.homeTeam.name),
      awayTeam: normaliseTeamName(item.match.awayTeam.name),

      homeGoals: homeScore?.matchScore.goals ?? 0,
      homeBehinds: homeScore?.matchScore.behinds ?? 0,
      homePoints,
      awayGoals: awayScore?.matchScore.goals ?? 0,
      awayBehinds: awayScore?.matchScore.behinds ?? 0,
      awayPoints,
      margin: homePoints - awayPoints,

      q1Home: findPeriod(homeScore?.periodScore, 1),
      q2Home: findPeriod(homeScore?.periodScore, 2),
      q3Home: findPeriod(homeScore?.periodScore, 3),
      q4Home: findPeriod(homeScore?.periodScore, 4),
      q1Away: findPeriod(awayScore?.periodScore, 1),
      q2Away: findPeriod(awayScore?.periodScore, 2),
      q3Away: findPeriod(awayScore?.periodScore, 3),
      q4Away: findPeriod(awayScore?.periodScore, 4),

      status: toMatchStatus(item.match.status),
      attendance: null,
      venueState: item.venue?.state ?? null,
      venueTimezone: item.venue?.timeZone ?? null,
      homeRushedBehinds: homeScore?.rushedBehinds ?? null,
      awayRushedBehinds: awayScore?.rushedBehinds ?? null,
      homeMinutesInFront: homeScore?.minutesInFront ?? null,
      awayMinutesInFront: awayScore?.minutesInFront ?? null,
      source,
      competition,
    };
  });
}
