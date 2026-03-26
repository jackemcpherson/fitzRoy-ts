/**
 * Pure transforms for flattening raw AFL API match items into typed MatchResult objects.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchItem, PeriodScore } from "../lib/validation";
import type { CompetitionCode, DataSource, MatchResult, MatchStatus, QuarterScore } from "../types";

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
      roundType: "HomeAndAway" as const,
      date: new Date(item.match.utcStartTime),
      venue: item.venue?.name ?? "",
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
      source,
      competition,
    };
  });
}
