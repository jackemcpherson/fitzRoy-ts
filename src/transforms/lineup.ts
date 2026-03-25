/**
 * Pure transforms for normalising raw AFL API match roster data into typed Lineup objects.
 */

import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchRoster } from "../lib/validation";
import type { CompetitionCode, Lineup, LineupPlayer } from "../types";

/** Position codes that indicate emergency or substitute status. */
const EMERGENCY_POSITIONS = new Set(["EMG", "EMERG"]);
const SUBSTITUTE_POSITIONS = new Set(["SUB", "INT"]);

/**
 * Transform a raw match roster into a typed Lineup object.
 *
 * @param roster - Raw match roster from the /cfs/ endpoint.
 * @param season - The season year.
 * @param roundNumber - The round number.
 * @param competition - The competition code.
 * @returns Typed Lineup with normalised team names and player lists.
 */
export function transformMatchRoster(
  roster: MatchRoster,
  season: number,
  roundNumber: number,
  competition: CompetitionCode,
): Lineup {
  const homeTeamId = roster.match.homeTeamId;
  const awayTeamId = roster.match.awayTeamId;

  const homeTeamPlayers = roster.teamPlayers.find((tp) => tp.teamId === homeTeamId);
  const awayTeamPlayers = roster.teamPlayers.find((tp) => tp.teamId === awayTeamId);

  const mapPlayers = (players: MatchRoster["teamPlayers"][number]["players"]): LineupPlayer[] =>
    players.map((p) => {
      const inner = p.player.player;
      const position = p.player.position ?? null;

      return {
        playerId: inner.playerId,
        givenName: inner.playerName.givenName,
        surname: inner.playerName.surname,
        displayName: `${inner.playerName.givenName} ${inner.playerName.surname}`,
        jumperNumber: p.jumperNumber ?? null,
        position,
        isEmergency: position !== null && EMERGENCY_POSITIONS.has(position),
        isSubstitute: position !== null && SUBSTITUTE_POSITIONS.has(position),
      };
    });

  return {
    matchId: roster.match.matchId,
    season,
    roundNumber,
    homeTeam: normaliseTeamName(roster.match.homeTeam.name),
    awayTeam: normaliseTeamName(roster.match.awayTeam.name),
    homePlayers: homeTeamPlayers ? mapPlayers(homeTeamPlayers.players) : [],
    awayPlayers: awayTeamPlayers ? mapPlayers(awayTeamPlayers.players) : [],
    competition,
  };
}
