/**
 * Pure transforms for flattening raw AFL API player stats into typed PlayerStats objects.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import type { PlayerStatsItem, PlayerStatsList } from "../lib/validation";
import type { CompetitionCode, DataSource, PlayerStats } from "../types";

/** Coerce `undefined` to `null` for optional numeric stat fields. */
function toNullable(value: number | null | undefined): number | null {
  return value ?? null;
}

/**
 * Transform a single raw player stats item into a typed PlayerStats object.
 */
function transformOne(
  item: PlayerStatsItem,
  matchId: string,
  season: number,
  roundNumber: number,
  competition: CompetitionCode,
  source: DataSource,
  teamIdMap?: ReadonlyMap<string, string>,
): PlayerStats {
  const inner = item.player.player.player;
  const stats = item.playerStats.stats;
  const clearances = stats.clearances;

  return {
    matchId,
    season,
    roundNumber,
    team: normaliseTeamName(teamIdMap?.get(item.teamId) ?? item.teamId),
    competition,

    playerId: inner.playerId,
    givenName: inner.playerName.givenName,
    surname: inner.playerName.surname,
    displayName: `${inner.playerName.givenName} ${inner.playerName.surname}`,
    jumperNumber: item.player.jumperNumber ?? null,

    kicks: toNullable(stats.kicks),
    handballs: toNullable(stats.handballs),
    disposals: toNullable(stats.disposals),
    marks: toNullable(stats.marks),
    goals: toNullable(stats.goals),
    behinds: toNullable(stats.behinds),
    tackles: toNullable(stats.tackles),
    hitouts: toNullable(stats.hitouts),
    freesFor: toNullable(stats.freesFor),
    freesAgainst: toNullable(stats.freesAgainst),

    contestedPossessions: toNullable(stats.contestedPossessions),
    uncontestedPossessions: toNullable(stats.uncontestedPossessions),
    contestedMarks: toNullable(stats.contestedMarks),
    intercepts: toNullable(stats.intercepts),

    centreClearances: toNullable(clearances?.centreClearances),
    stoppageClearances: toNullable(clearances?.stoppageClearances),
    totalClearances: toNullable(clearances?.totalClearances),

    inside50s: toNullable(stats.inside50s),
    rebound50s: toNullable(stats.rebound50s),
    clangers: toNullable(stats.clangers),
    turnovers: toNullable(stats.turnovers),
    onePercenters: toNullable(stats.onePercenters),
    bounces: toNullable(stats.bounces),
    goalAssists: toNullable(stats.goalAssists),
    disposalEfficiency: toNullable(stats.disposalEfficiency),
    metresGained: toNullable(stats.metresGained),

    dreamTeamPoints: toNullable(stats.dreamTeamPoints),
    supercoachPoints: null,
    brownlowVotes: null,

    source,
  };
}

/**
 * Transform raw AFL API player stats list into typed PlayerStats objects.
 *
 * @param data - Raw player stats response with home/away arrays.
 * @param matchId - The match provider ID.
 * @param season - The season year.
 * @param roundNumber - The round number.
 * @param competition - The competition code.
 * @returns Flattened PlayerStats array (home players first, then away).
 */
export function transformPlayerStats(
  data: PlayerStatsList,
  matchId: string,
  season: number,
  roundNumber: number,
  competition: CompetitionCode,
  source: DataSource = "afl-api",
  teamIdMap?: ReadonlyMap<string, string>,
): PlayerStats[] {
  const home = data.homeTeamPlayerStats.map((item) =>
    transformOne(item, matchId, season, roundNumber, competition, source, teamIdMap),
  );
  const away = data.awayTeamPlayerStats.map((item) =>
    transformOne(item, matchId, season, roundNumber, competition, source, teamIdMap),
  );
  return [...home, ...away];
}
