/**
 * Public API for fetching player biographical details.
 *
 * Supports three data sources: AFL API (via squad endpoint), FootyWire
 * (team history page scraping), and AFL Tables (team page scraping).
 */

import { UnsupportedSourceError, ValidationError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import { AflApiClient } from "../sources/afl-api";
import { AflTablesClient } from "../sources/afl-tables";
import { FootyWireClient } from "../sources/footywire";
import type { CompetitionCode, PlayerDetails, PlayerDetailsQuery } from "../types";

/**
 * Map a canonical team name to a numeric AFL API team ID.
 *
 * Fetches the team list from the API and matches by normalised name.
 */
async function resolveTeamId(
  client: AflApiClient,
  teamName: string,
  competition: CompetitionCode,
): Promise<Result<string, Error>> {
  const teamType = competition === "AFLW" ? "WOMEN" : "MEN";
  const result = await client.fetchTeams(teamType);
  if (!result.success) return result;

  const normalised = normaliseTeamName(teamName);
  const match = result.data.find((t) => normaliseTeamName(t.name) === normalised);
  if (!match) {
    return err(new ValidationError(`Team not found: ${teamName}`));
  }
  return ok(String(match.id));
}

/**
 * Fetch player details from the AFL API (reuses the squad endpoint).
 */
async function fetchFromAflApi(query: PlayerDetailsQuery): Promise<Result<PlayerDetails[], Error>> {
  const client = new AflApiClient();
  const competition = query.competition ?? "AFLM";
  const season = query.season ?? new Date().getFullYear();

  const [teamIdResult, seasonResult] = await Promise.all([
    resolveTeamId(client, query.team, competition),
    client.resolveCompSeason(competition, season),
  ]);
  if (!teamIdResult.success) return teamIdResult;
  if (!seasonResult.success) return seasonResult;

  const teamId = Number.parseInt(teamIdResult.data, 10);
  if (Number.isNaN(teamId)) {
    return err(new ValidationError(`Invalid team ID: ${teamIdResult.data}`));
  }

  const squadResult = await client.fetchSquad(teamId, seasonResult.data);
  if (!squadResult.success) return squadResult;

  const teamName = normaliseTeamName(squadResult.data.squad.team?.name ?? query.team);

  const players: PlayerDetails[] = squadResult.data.squad.players.map((p) => ({
    playerId: p.player.providerId ?? String(p.player.id),
    givenName: p.player.firstName,
    surname: p.player.surname,
    displayName: `${p.player.firstName} ${p.player.surname}`,
    team: teamName,
    jumperNumber: p.jumperNumber ?? null,
    position: p.position ?? null,
    dateOfBirth: p.player.dateOfBirth ?? null,
    heightCm: p.player.heightInCm ?? null,
    weightKg: p.player.weightInKg ?? null,
    gamesPlayed: null,
    goals: null,
    draftYear: p.player.draftYear ? Number.parseInt(p.player.draftYear, 10) || null : null,
    draftPosition: p.player.draftPosition
      ? Number.parseInt(p.player.draftPosition, 10) || null
      : null,
    draftType: p.player.draftType ?? null,
    debutYear: p.player.debutYear ? Number.parseInt(p.player.debutYear, 10) || null : null,
    recruitedFrom: p.player.recruitedFrom ?? null,
    source: "afl-api" as const,
    competition,
  }));

  return ok(players);
}

/**
 * Fetch player details from FootyWire (team history page).
 */
async function fetchFromFootyWire(
  query: PlayerDetailsQuery,
): Promise<Result<PlayerDetails[], Error>> {
  const client = new FootyWireClient();
  const competition = query.competition ?? "AFLM";
  const teamName = normaliseTeamName(query.team);

  const result = await client.fetchPlayerList(teamName);
  if (!result.success) return result;

  const players: PlayerDetails[] = result.data.map((p) => ({
    ...p,
    source: "footywire" as const,
    competition,
  }));

  return ok(players);
}

/**
 * Fetch player details from AFL Tables (team page).
 */
async function fetchFromAflTables(
  query: PlayerDetailsQuery,
): Promise<Result<PlayerDetails[], Error>> {
  const client = new AflTablesClient();
  const competition = query.competition ?? "AFLM";
  const teamName = normaliseTeamName(query.team);

  const result = await client.fetchPlayerList(teamName);
  if (!result.success) return result;

  const players: PlayerDetails[] = result.data.map((p) => ({
    ...p,
    source: "afl-tables" as const,
    competition,
  }));

  return ok(players);
}

/**
 * Fetch player biographical details (DOB, height, draft info, etc.).
 *
 * Dispatches to the appropriate data source based on `query.source`.
 *
 * @param query - Team name, source, and optional season/competition filters.
 * @returns Array of player details.
 *
 * @example
 * ```ts
 * const result = await fetchPlayerDetails({
 *   source: "afl-api",
 *   team: "Carlton",
 *   season: 2025,
 * });
 * ```
 */
export async function fetchPlayerDetails(
  query: PlayerDetailsQuery,
): Promise<Result<PlayerDetails[], Error>> {
  switch (query.source) {
    case "afl-api":
      return fetchFromAflApi(query);
    case "footywire":
      return fetchFromFootyWire(query);
    case "afl-tables":
      return fetchFromAflTables(query);
    default:
      return err(
        new UnsupportedSourceError(
          `Source "${query.source}" is not supported for player details. Use "afl-api", "footywire", or "afl-tables".`,
          query.source,
        ),
      );
  }
}
