/**
 * Pure transforms for flattening raw AFL API player stats into typed PlayerStats objects.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import type { PlayerStatsItem, PlayerStatsList } from "../lib/validation";
import type { CompetitionCode, DataSource, PlayerStats } from "../types";

function stat(value: number | null | undefined): number | null {
  return value != null ? value : null;
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
): PlayerStats {
  const inner = item.player.player.player;
  const stats = item.playerStats.stats;
  const clearances = stats.clearances;

  return {
    matchId,
    season,
    roundNumber,
    team: normaliseTeamName(item.teamId),
    competition,

    playerId: inner.playerId,
    givenName: inner.playerName.givenName,
    surname: inner.playerName.surname,
    displayName: `${inner.playerName.givenName} ${inner.playerName.surname}`,
    jumperNumber: item.player.jumperNumber ?? null,

    kicks: stat(stats.kicks),
    handballs: stat(stats.handballs),
    disposals: stat(stats.disposals),
    marks: stat(stats.marks),
    goals: stat(stats.goals),
    behinds: stat(stats.behinds),
    tackles: stat(stats.tackles),
    hitouts: stat(stats.hitouts),
    freesFor: stat(stats.freesFor),
    freesAgainst: stat(stats.freesAgainst),

    contestedPossessions: stat(stats.contestedPossessions),
    uncontestedPossessions: stat(stats.uncontestedPossessions),
    contestedMarks: stat(stats.contestedMarks),
    intercepts: stat(stats.intercepts),

    centreClearances: stat(clearances?.centreClearances),
    stoppageClearances: stat(clearances?.stoppageClearances),
    totalClearances: stat(clearances?.totalClearances),

    inside50s: stat(stats.inside50s),
    rebound50s: stat(stats.rebound50s),
    clangers: stat(stats.clangers),
    turnovers: stat(stats.turnovers),
    onePercenters: stat(stats.onePercenters),
    bounces: stat(stats.bounces),
    goalAssists: stat(stats.goalAssists),
    disposalEfficiency: stat(stats.disposalEfficiency),
    metresGained: stat(stats.metresGained),

    dreamTeamPoints: stat(stats.dreamTeamPoints),
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
): PlayerStats[] {
  const home = data.homeTeamPlayerStats.map((item) =>
    transformOne(item, matchId, season, roundNumber, competition, source),
  );
  const away = data.awayTeamPlayerStats.map((item) =>
    transformOne(item, matchId, season, roundNumber, competition, source),
  );
  return [...home, ...away];
}
