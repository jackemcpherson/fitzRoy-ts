/**
 * FootyWire source adapters.
 *
 * FootyWire is AFLM-only (no AFLW or VFL coverage). Each capability has
 * its own class so per-capability coverage stays accurate.
 */

import { parseDate } from "../../lib/date-utils";
import { ok, type Result } from "../../lib/result";
import { normaliseTeamName } from "../../lib/team-mapping";
import type {
  Match,
  MatchQuery,
  PlayerStats,
  PlayerStatsQuery,
  Squad,
  SquadPlayer,
  SquadQuery,
  TeamStatsEntry,
  TeamStatsQuery,
} from "../../types";
import { FootyWireClient } from "../footywire";
import type { MatchSource, PlayerStatsSource, SquadSource, TeamStatsSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const FOOTYWIRE_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);
const FOOTYWIRE_PLAYER_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);
const FOOTYWIRE_TEAM_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);
const FOOTYWIRE_SQUAD_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 2010 }]]);

/** FootyWire as a MatchSource (AFLM only, ~2010+). */
export class FootyWireMatchSource implements MatchSource {
  readonly id = "footywire" as const;
  readonly coverage = FOOTYWIRE_MATCH_COVERAGE;

  constructor(private readonly client: FootyWireClient = new FootyWireClient()) {}

  async fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
    // fetchSeasonFixture returns ALL matches (any status). fetchSeasonResults
    // returns only completed. Use the broader call so the api-layer status
    // filter applies uniformly across sources.
    const result = await this.client.fetchSeasonFixture(query.season);
    if (!result.success) return result;
    const filtered =
      query.round != null ? result.data.filter((m) => m.roundNumber === query.round) : result.data;
    return ok(filtered);
  }
}

/**
 * FootyWire as a PlayerStatsSource (AFLM only, ~2010+).
 *
 * Scrapes per-match stats sequentially in batches of 5 with a delay
 * between batches to be respectful to the FootyWire site.
 */
export class FootyWirePlayerStatsSource implements PlayerStatsSource {
  readonly id = "footywire" as const;
  readonly coverage = FOOTYWIRE_PLAYER_STATS_COVERAGE;

  constructor(private readonly client: FootyWireClient = new FootyWireClient()) {}

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<PlayerStats[], Error>> {
    const idsResult = await this.client.fetchSeasonMatchIds(query.season);
    if (!idsResult.success) return idsResult;

    const entries =
      query.round != null
        ? idsResult.data.filter((e) => e.roundNumber === query.round)
        : idsResult.data;

    if (entries.length === 0) return ok([]);

    const allStats: PlayerStats[] = [];
    const batchSize = 5;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((e) => this.client.fetchMatchPlayerStats(e.matchId, query.season, e.roundNumber)),
      );

      for (const result of results) {
        if (result.success) {
          allStats.push(...result.data);
        }
      }

      if (i + batchSize < entries.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return ok(allStats);
  }
}

/** FootyWire as a SquadSource (AFLM only — scrapes the team history page). */
export class FootyWireSquadSource implements SquadSource {
  readonly id = "footywire" as const;
  readonly coverage = FOOTYWIRE_SQUAD_COVERAGE;

  constructor(private readonly client: FootyWireClient = new FootyWireClient()) {}

  async fetchSquad(query: SquadQuery): Promise<Result<Squad, Error>> {
    const competition = query.competition ?? "AFLM";
    const teamName = normaliseTeamName(query.team);
    const result = await this.client.fetchPlayerList(teamName);
    if (!result.success) return result;

    const players: SquadPlayer[] = result.data.map((p) => ({
      playerId: p.playerId,
      givenName: p.givenName,
      surname: p.surname,
      displayName: p.displayName,
      jumperNumber: p.jumperNumber,
      position: p.position,
      dateOfBirth: p.dateOfBirth ? parseDate(p.dateOfBirth) : null,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      draftYear: p.draftYear,
      draftPosition: p.draftPosition,
      draftType: p.draftType,
      debutYear: p.debutYear,
      recruitedFrom: p.recruitedFrom,
      gamesPlayed: p.gamesPlayed,
      goals: p.goals,
    }));

    return ok({
      teamId: teamName,
      teamName,
      season: query.season,
      players,
      competition,
    });
  }
}

/** FootyWire as a TeamStatsSource (AFLM only). */
export class FootyWireTeamStatsSource implements TeamStatsSource {
  readonly id = "footywire" as const;
  readonly coverage = FOOTYWIRE_TEAM_STATS_COVERAGE;

  constructor(private readonly client: FootyWireClient = new FootyWireClient()) {}

  async fetchTeamStats(query: TeamStatsQuery): Promise<Result<TeamStatsEntry[], Error>> {
    const summaryType = query.summaryType ?? "totals";
    return this.client.fetchTeamStats(query.season, summaryType);
  }
}
