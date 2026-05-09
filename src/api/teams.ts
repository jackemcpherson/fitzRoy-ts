/**
 * Public API for fetching team lists and squad rosters.
 */

import { ok, Result } from "../lib/result";
import { AFL_SENIOR_TEAMS, normaliseTeamName } from "../lib/team-mapping";
import { dispatch, squadRegistry } from "../sources/adapters/index";
import { AflApiClient } from "../sources/afl-api";
import type { CompetitionCode, Squad, SquadQuery, Team, TeamQuery } from "../types";

/**
 * AFLW clubs the upstream `/teams?teamType=WOMEN` endpoint omits even though
 * AFLW match data references them — they entered AFLW in 2022 but don't have
 * separate WOMEN team records yet, so AFLW match data uses their MEN team
 * IDs (#83). Static backfill keyed by canonical name → MEN team id.
 */
const AFLW_TEAM_BACKFILL: ReadonlyArray<{
  readonly id: string;
  readonly name: string;
  readonly abbreviation: string;
}> = [
  { id: "12", name: "Essendon", abbreviation: "ESS" },
  { id: "9", name: "Hawthorn", abbreviation: "HAW" },
  { id: "13", name: "Sydney Swans", abbreviation: "SYD" },
  { id: "7", name: "Port Adelaide", abbreviation: "PORT" },
];

/**
 * Map raw API team objects to domain Team objects.
 *
 * For AFLM, applies the {@link AFL_SENIOR_TEAMS} allow-list to strip
 * representative teams (Victoria, All Stars). For other competitions
 * (AFLW, VFL, VFLW), passes the full list through — the AFLM-only filter
 * was previously stripping legitimate standalone VFL/VFLW clubs (#80).
 *
 * For AFLW, also augments with the four senior clubs missing from the
 * upstream `/teams` endpoint (#83).
 */
function toTeams(
  data: ReadonlyArray<{ id: number; name: string; abbreviation?: string | undefined }>,
  competition: CompetitionCode,
): Team[] {
  const mapped = data.map((t) => ({
    teamId: String(t.id),
    name: normaliseTeamName(t.name),
    abbreviation: t.abbreviation ?? "",
    competition,
  }));

  let result = competition === "AFLM" ? mapped.filter((t) => AFL_SENIOR_TEAMS.has(t.name)) : mapped;

  if (competition === "AFLW") {
    const present = new Set(result.map((t) => t.name));
    for (const backfill of AFLW_TEAM_BACKFILL) {
      if (!present.has(backfill.name)) {
        result = [...result, { ...backfill, teamId: backfill.id, competition }];
      }
    }
  }

  return result;
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
 * `query.team` is the canonical team name; adapters handle their own
 * translation (AFL API resolves it to a numeric ID; scrapers use the
 * name directly). When `query.source` is omitted, routes to the default
 * source for the squad capability.
 */
export async function fetchSquad(query: SquadQuery): Promise<Result<Squad, Error>> {
  const source = query.source ?? squadRegistry.defaultSource;
  const adapterR = dispatch(squadRegistry, "squad", {
    source,
    competition: query.competition,
    season: query.season,
  });
  return Result.flatMapAsync(adapterR, (a) => a.fetchSquad({ ...query, source }));
}
