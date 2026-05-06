/**
 * Pure transforms over Squad data.
 *
 * `PlayerDetails` is the flat denormalised view of `Squad` — one row
 * per player with the team name folded in and `source` / `competition`
 * provenance attached. Per CONTEXT.md, Squad is the canonical "team
 * roster" type and PlayerDetails is one of its presentation views.
 */

import type { DataSource, PlayerDetails, Squad } from "../types";

/**
 * Spread a `Squad` into flat `PlayerDetails` rows.
 *
 * Every player gets the squad's team name baked in plus the requested
 * `source` and the squad's `competition`. Career counts (`gamesPlayed`,
 * `goals`) flow through unchanged — AFL API squads leave them undefined,
 * scraper squads populate them from the team-list page.
 */
export function squadToPlayerDetails(squad: Squad, source: DataSource): PlayerDetails[] {
  return squad.players.map((p) => ({
    playerId: p.playerId,
    givenName: p.givenName,
    surname: p.surname,
    displayName: p.displayName,
    team: squad.teamName,
    jumperNumber: p.jumperNumber,
    position: p.position,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    gamesPlayed: p.gamesPlayed ?? null,
    goals: p.goals ?? null,
    draftYear: p.draftYear,
    draftPosition: p.draftPosition,
    draftType: p.draftType,
    debutYear: p.debutYear,
    recruitedFrom: p.recruitedFrom,
    source,
    competition: squad.competition,
  }));
}
