/**
 * Public API for fetching player biographical details.
 *
 * Supports three data sources: AFL API (via squad endpoint), FootyWire
 * (team history page scraping), and AFL Tables (team page scraping).
 */

import { batchedMap } from "../lib/concurrency";
import { resolveDefaultSeason } from "../lib/date-utils";
import { aflwUnsupportedError, UnsupportedSourceError, ValidationError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { AFL_SENIOR_TEAMS, normaliseTeamName } from "../lib/team-mapping";
import type { SquadList } from "../lib/validation";
import { AflApiClient } from "../sources/afl-api";
import { AflTablesClient } from "../sources/afl-tables";
import { FootyWireClient } from "../sources/footywire";
import type { CompetitionCode, DataSource, PlayerDetails, PlayerDetailsQuery } from "../types";

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

/** Map an AFL API squad response to PlayerDetails[]. */
function mapSquadToPlayerDetails(
  data: SquadList,
  fallbackTeamName: string,
  competition: CompetitionCode,
): PlayerDetails[] {
  const resolvedName = normaliseTeamName(data.squad.team?.name ?? fallbackTeamName);

  return data.squad.players.map((p) => ({
    playerId: p.player.providerId ?? String(p.player.id),
    givenName: p.player.firstName,
    surname: p.player.surname,
    displayName: `${p.player.firstName} ${p.player.surname}`,
    team: resolvedName,
    jumperNumber: p.jumperNumber ?? null,
    position: p.position ?? null,
    dateOfBirth: p.player.dateOfBirth ?? null,
    heightCm: p.player.heightInCm || null,
    weightKg: p.player.weightInKg || null,
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
}

/**
 * Fetch player details from the AFL API (reuses the squad endpoint).
 */
async function fetchFromAflApi(query: PlayerDetailsQuery): Promise<Result<PlayerDetails[], Error>> {
  const client = new AflApiClient();
  const competition = query.competition ?? "AFLM";
  const season = query.season ?? resolveDefaultSeason(competition);

  const seasonResult = await client.resolveCompSeason(competition, season);
  if (!seasonResult.success) return seasonResult;

  if (query.team) {
    const teamIdResult = await resolveTeamId(client, query.team, competition);
    if (!teamIdResult.success) return teamIdResult;

    const teamId = Number.parseInt(teamIdResult.data, 10);
    if (Number.isNaN(teamId)) {
      return err(new ValidationError(`Invalid team ID: ${teamIdResult.data}`));
    }

    const squadResult = await client.fetchSquad(teamId, seasonResult.data);
    if (!squadResult.success) return squadResult;

    return ok(mapSquadToPlayerDetails(squadResult.data, query.team, competition));
  }

  // Fetch all teams — resolve IDs in one call, then batch-fetch squads
  const teamType = competition === "AFLW" ? "WOMEN" : "MEN";
  const teamsResult = await client.fetchTeams(teamType);
  if (!teamsResult.success) return teamsResult;

  const teamEntries = teamsResult.data.map((t) => ({
    id: Number.parseInt(String(t.id), 10),
    name: normaliseTeamName(t.name),
  }));

  const results = await batchedMap(teamEntries, (entry) =>
    client.fetchSquad(entry.id, seasonResult.data),
  );

  const allPlayers: PlayerDetails[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const entry = teamEntries[i];
    if (result?.success && entry) {
      allPlayers.push(...mapSquadToPlayerDetails(result.data, entry.name, competition));
    }
  }

  return ok(allPlayers);
}

/**
 * Fetch player details for all teams from a scraper source.
 *
 * Uses AFL_SENIOR_TEAMS as the canonical team list to avoid an API dependency.
 */
async function fetchAllTeamsFromScraper(
  fetchFn: (
    teamName: string,
  ) => Promise<Result<Omit<PlayerDetails, "source" | "competition">[], Error>>,
  source: DataSource,
  competition: CompetitionCode,
): Promise<Result<PlayerDetails[], Error>> {
  const teamNames = [...AFL_SENIOR_TEAMS];
  const results = await batchedMap(teamNames, (name) => fetchFn(name));

  const allPlayers: PlayerDetails[] = [];
  for (const result of results) {
    if (result.success) {
      allPlayers.push(...result.data.map((p) => ({ ...p, source, competition })));
    }
  }

  return ok(allPlayers);
}

/**
 * Fetch player details from FootyWire (team history page).
 */
async function fetchFromFootyWire(
  query: PlayerDetailsQuery,
): Promise<Result<PlayerDetails[], Error>> {
  const competition = query.competition ?? "AFLM";
  if (competition === "AFLW") return err(aflwUnsupportedError("footywire"));
  const client = new FootyWireClient();

  if (query.team) {
    const teamName = normaliseTeamName(query.team);
    const result = await client.fetchPlayerList(teamName);
    if (!result.success) return result;

    return ok(result.data.map((p) => ({ ...p, source: "footywire" as const, competition })));
  }

  return fetchAllTeamsFromScraper((name) => client.fetchPlayerList(name), "footywire", competition);
}

/**
 * Fetch player details from AFL Tables (team page).
 */
async function fetchFromAflTables(
  query: PlayerDetailsQuery,
): Promise<Result<PlayerDetails[], Error>> {
  const competition = query.competition ?? "AFLM";
  if (competition === "AFLW") return err(aflwUnsupportedError("afl-tables"));
  const client = new AflTablesClient();

  if (query.team) {
    const teamName = normaliseTeamName(query.team);
    const result = await client.fetchPlayerList(teamName);
    if (!result.success) return result;

    return ok(result.data.map((p) => ({ ...p, source: "afl-tables" as const, competition })));
  }

  return fetchAllTeamsFromScraper(
    (name) => client.fetchPlayerList(name),
    "afl-tables",
    competition,
  );
}

/**
 * Fetch player biographical details (DOB, height, draft info, etc.).
 *
 * Dispatches to the appropriate data source based on `query.source`.
 * When `query.team` is omitted, returns details for all teams.
 *
 * @param query - Source, optional team name, and optional season/competition filters.
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
