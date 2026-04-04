/**
 * Pure transforms for flattening raw AFL API player stats into typed PlayerStats objects.
 */

import { AFL_API_TEAM_IDS, normaliseTeamName } from "../lib/team-mapping";
import type { PlayerStatsItem, PlayerStatsList } from "../lib/validation";
import type { CompetitionCode, DataSource, PlayerStats } from "../types";

/** Coerce `undefined` to `null` for optional numeric stat fields. */
function toNullable(value: number | null | undefined): number | null {
  return value ?? null;
}

/** Context for a single match transform. */
interface TransformContext {
  readonly matchId: string;
  readonly season: number;
  readonly roundNumber: number;
  readonly competition: CompetitionCode;
  readonly source: DataSource;
  readonly teamIdMap?: ReadonlyMap<string, string>;
  readonly date?: Date | null;
  readonly homeTeam?: string | null;
  readonly awayTeam?: string | null;
}

/**
 * Transform a single raw player stats item into a typed PlayerStats object.
 */
function transformOne(item: PlayerStatsItem, ctx: TransformContext): PlayerStats {
  const inner = item.player.player.player;
  const stats = item.playerStats?.stats;
  const clearances = stats?.clearances;

  return {
    matchId: ctx.matchId,
    season: ctx.season,
    roundNumber: ctx.roundNumber,
    team: normaliseTeamName(
      ctx.teamIdMap?.get(item.teamId) ?? AFL_API_TEAM_IDS.get(item.teamId) ?? item.teamId,
    ),
    competition: ctx.competition,

    date: ctx.date ?? null,
    homeTeam: ctx.homeTeam ?? null,
    awayTeam: ctx.awayTeam ?? null,

    playerId: inner.playerId,
    givenName: inner.playerName.givenName,
    surname: inner.playerName.surname,
    displayName: `${inner.playerName.givenName} ${inner.playerName.surname}`,
    jumperNumber: item.player.jumperNumber ?? null,

    kicks: toNullable(stats?.kicks),
    handballs: toNullable(stats?.handballs),
    disposals: toNullable(stats?.disposals),
    marks: toNullable(stats?.marks),
    goals: toNullable(stats?.goals),
    behinds: toNullable(stats?.behinds),
    tackles: toNullable(stats?.tackles),
    hitouts: toNullable(stats?.hitouts),
    freesFor: toNullable(stats?.freesFor),
    freesAgainst: toNullable(stats?.freesAgainst),

    contestedPossessions: toNullable(stats?.contestedPossessions),
    uncontestedPossessions: toNullable(stats?.uncontestedPossessions),
    contestedMarks: toNullable(stats?.contestedMarks),
    intercepts: toNullable(stats?.intercepts),

    centreClearances: toNullable(clearances?.centreClearances),
    stoppageClearances: toNullable(clearances?.stoppageClearances),
    totalClearances: toNullable(clearances?.totalClearances),

    inside50s: toNullable(stats?.inside50s),
    rebound50s: toNullable(stats?.rebound50s),
    clangers: toNullable(stats?.clangers),
    turnovers: toNullable(stats?.turnovers),
    onePercenters: toNullable(stats?.onePercenters),
    bounces: toNullable(stats?.bounces),
    goalAssists: toNullable(stats?.goalAssists),
    disposalEfficiency: toNullable(stats?.disposalEfficiency),
    metresGained: toNullable(stats?.metresGained),

    goalAccuracy: toNullable(stats?.goalAccuracy),
    marksInside50: toNullable(stats?.marksInside50),
    tacklesInside50: toNullable(stats?.tacklesInside50),
    shotsAtGoal: toNullable(stats?.shotsAtGoal),
    scoreInvolvements: toNullable(stats?.scoreInvolvements),
    totalPossessions: toNullable(stats?.totalPossessions),
    timeOnGroundPercentage: toNullable(item.playerStats?.timeOnGroundPercentage),
    ratingPoints: toNullable(stats?.ratingPoints),

    position: item.player.player.position ?? null,

    goalEfficiency: toNullable(stats?.goalEfficiency),
    shotEfficiency: toNullable(stats?.shotEfficiency),
    interchangeCounts: toNullable(stats?.interchangeCounts),

    supercoachScore: null,
    dreamTeamPoints: toNullable(stats?.dreamTeamPoints),

    effectiveDisposals: toNullable(stats?.extendedStats?.effectiveDisposals),
    effectiveKicks: toNullable(stats?.extendedStats?.effectiveKicks),
    kickEfficiency: toNullable(stats?.extendedStats?.kickEfficiency),
    kickToHandballRatio: toNullable(stats?.extendedStats?.kickToHandballRatio),
    pressureActs: toNullable(stats?.extendedStats?.pressureActs),
    defHalfPressureActs: toNullable(stats?.extendedStats?.defHalfPressureActs),
    spoils: toNullable(stats?.extendedStats?.spoils),
    hitoutsToAdvantage: toNullable(stats?.extendedStats?.hitoutsToAdvantage),
    hitoutWinPercentage: toNullable(stats?.extendedStats?.hitoutWinPercentage),
    hitoutToAdvantageRate: toNullable(stats?.extendedStats?.hitoutToAdvantageRate),
    groundBallGets: toNullable(stats?.extendedStats?.groundBallGets),
    f50GroundBallGets: toNullable(stats?.extendedStats?.f50GroundBallGets),
    interceptMarks: toNullable(stats?.extendedStats?.interceptMarks),
    marksOnLead: toNullable(stats?.extendedStats?.marksOnLead),
    contestedPossessionRate: toNullable(stats?.extendedStats?.contestedPossessionRate),
    contestOffOneOnOnes: toNullable(stats?.extendedStats?.contestOffOneOnOnes),
    contestOffWins: toNullable(stats?.extendedStats?.contestOffWins),
    contestOffWinsPercentage: toNullable(stats?.extendedStats?.contestOffWinsPercentage),
    contestDefOneOnOnes: toNullable(stats?.extendedStats?.contestDefOneOnOnes),
    contestDefLosses: toNullable(stats?.extendedStats?.contestDefLosses),
    contestDefLossPercentage: toNullable(stats?.extendedStats?.contestDefLossPercentage),
    centreBounceAttendances: toNullable(stats?.extendedStats?.centreBounceAttendances),
    kickins: toNullable(stats?.extendedStats?.kickins),
    kickinsPlayon: toNullable(stats?.extendedStats?.kickinsPlayon),
    ruckContests: toNullable(stats?.extendedStats?.ruckContests),
    scoreLaunches: toNullable(stats?.extendedStats?.scoreLaunches),

    source: ctx.source,
  };
}

/**
 * Transform raw AFL API player stats list into typed PlayerStats objects.
 *
 * @param data - Raw player stats response with home/away arrays.
 * @param ctx - Match context (IDs, season, round, source, team mappings, match metadata).
 * @returns Flattened PlayerStats array (home players first, then away).
 */
export function transformPlayerStats(data: PlayerStatsList, ctx: TransformContext): PlayerStats[] {
  const home = (data.homeTeamPlayerStats ?? []).map((item) => transformOne(item, ctx));
  const away = (data.awayTeamPlayerStats ?? []).map((item) => transformOne(item, ctx));
  return [...home, ...away];
}

export type { TransformContext };
