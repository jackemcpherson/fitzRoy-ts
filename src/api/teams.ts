/**
 * Public API for fetching team lists and squad rosters.
 */

import { AflApiError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import { AflApiClient } from "../sources/afl-api";
import type { CompetitionCode, Squad, SquadPlayer, SquadQuery, Team, TeamQuery } from "../types";

/** Map CompetitionCode to the team type filter used by the API. */
function teamTypeForComp(comp: CompetitionCode): string {
  return comp === "AFLW" ? "WOMEN" : "MEN";
}

/**
 * Fetch team lists.
 *
 * @param query - Optional competition and team type filters.
 * @returns Array of teams.
 */
export async function fetchTeams(query?: TeamQuery): Promise<Result<Team[], Error>> {
  const client = new AflApiClient();
  const teamType =
    query?.teamType ?? (query?.competition ? teamTypeForComp(query.competition) : undefined);

  const result = await client.fetchTeams(teamType);
  if (!result.success) return result;

  const competition = query?.competition ?? "AFLM";

  return ok(
    result.data.map((t) => ({
      teamId: String(t.id),
      name: normaliseTeamName(t.name),
      abbreviation: t.abbreviation ?? "",
      competition,
    })),
  );
}

/**
 * Fetch a team's squad roster for a season.
 *
 * @param query - Team ID, season, and optional competition.
 * @returns Squad with player list.
 */
export async function fetchSquad(query: SquadQuery): Promise<Result<Squad, Error>> {
  const client = new AflApiClient();
  const competition = query.competition ?? "AFLM";

  const seasonResult = await client.resolveCompSeason(competition, query.season);
  if (!seasonResult.success) return seasonResult;

  const teamId = Number.parseInt(query.teamId, 10);
  if (Number.isNaN(teamId)) {
    return err(new AflApiError(`Invalid team ID: ${query.teamId}`));
  }

  const squadResult = await client.fetchSquad(teamId, seasonResult.data);
  if (!squadResult.success) return squadResult;

  const players: SquadPlayer[] = squadResult.data.squad.players.map((p) => ({
    playerId: p.player.providerId ?? String(p.player.id),
    givenName: p.player.firstName,
    surname: p.player.surname,
    displayName: `${p.player.firstName} ${p.player.surname}`,
    jumperNumber: p.jumperNumber ?? null,
    position: p.position ?? null,
    dateOfBirth: p.player.dateOfBirth ? new Date(p.player.dateOfBirth) : null,
    heightCm: p.player.heightInCm ?? null,
    weightKg: p.player.weightInKg ?? null,
  }));

  return ok({
    teamId: query.teamId,
    teamName: normaliseTeamName(squadResult.data.squad.team?.name ?? query.teamId),
    season: query.season,
    players,
    competition,
  });
}
