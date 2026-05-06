/**
 * Public API for fetching team lists and squad rosters.
 */

import { err, ok, type Result } from "../lib/result";
import { AFL_SENIOR_TEAMS, normaliseTeamName } from "../lib/team-mapping";
import {
  checkCoverage,
  defaultSourceByCapability,
  getSquadSource,
  listSquadSources,
  unsupportedSourceForOperation,
} from "../sources/adapters/index";
import { AflApiClient } from "../sources/afl-api";
import type { CompetitionCode, Squad, SquadQuery, Team, TeamQuery } from "../types";

/** Map raw API team objects to domain Team objects, filtering to senior teams only. */
function toTeams(
  data: ReadonlyArray<{ id: number; name: string; abbreviation?: string | undefined }>,
  competition: CompetitionCode,
): Team[] {
  return data
    .map((t) => ({
      teamId: String(t.id),
      name: normaliseTeamName(t.name),
      abbreviation: t.abbreviation ?? "",
      competition,
    }))
    .filter((t) => AFL_SENIOR_TEAMS.has(t.name));
}

/**
 * Fetch team lists.
 *
 * @param query - Optional competition filter (defaults to AFLM and AFLW combined).
 * @returns Array of teams.
 */
export async function fetchTeams(query?: TeamQuery): Promise<Result<Team[], Error>> {
  const client = new AflApiClient();

  // When no competition specified, fetch both AFLM and AFLW teams (the AFL "senior" comps).
  if (!query?.competition) {
    const [menResult, womenResult] = await Promise.all([
      client.fetchTeams("AFLM"),
      client.fetchTeams("AFLW"),
    ]);
    if (!menResult.success) return menResult;
    if (!womenResult.success) return womenResult;

    return ok([...toTeams(menResult.data, "AFLM"), ...toTeams(womenResult.data, "AFLW")]);
  }

  const result = await client.fetchTeams(query.competition);
  if (!result.success) return result;

  return ok(toTeams(result.data, query.competition));
}

/**
 * Fetch a team's squad roster for a season.
 *
 * The dispatch is a 3-line registry lookup — per-source logic lives in
 * each adapter (see `src/sources/adapters/`). SquadQuery has no `source`
 * field today (only AFL API supports it), so we route to the default
 * SquadSource directly.
 */
export async function fetchSquad(query: SquadQuery): Promise<Result<Squad, Error>> {
  const sourceId = defaultSourceByCapability.squad;
  const adapter = getSquadSource(sourceId);
  if (!adapter) {
    return err(unsupportedSourceForOperation(sourceId, "squad", listSquadSources()));
  }

  const competition = query.competition ?? "AFLM";
  const coverage = checkCoverage(adapter.coverage, {
    source: sourceId,
    operation: "squad",
    competition,
    season: query.season,
  });
  if (!coverage.success) return coverage;

  return adapter.fetchSquad(query);
}
