/**
 * FootyWire source adapters.
 *
 * FootyWire is AFLM-only (no AFLW or VFL coverage). Each capability has
 * its own class so per-capability coverage stays accurate.
 */

import { batchedMap } from "../../lib/concurrency";
import { ok, type Result } from "../../lib/result";
import { normaliseTeamName } from "../../lib/team-mapping";
import type {
  Match,
  MatchQuery,
  Player,
  PlayerStats,
  PlayerStatsQuery,
  SeasonPlayerStats,
  Squad,
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
    const result = await this.client.fetchSeasonFixture(query.season, query.competition ?? "AFLM");
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
 * between batches to be respectful to the FootyWire site. Individual
 * match failures don't abort the scrape — they are surfaced in the
 * envelope's `failedMatchIds` (same `FW_…` namespace as the stat rows).
 */
export class FootyWirePlayerStatsSource implements PlayerStatsSource {
  readonly id = "footywire" as const;
  readonly coverage = FOOTYWIRE_PLAYER_STATS_COVERAGE;

  constructor(private readonly client: FootyWireClient = new FootyWireClient()) {}

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<SeasonPlayerStats, Error>> {
    const idsResult = await this.client.fetchSeasonMatchIds(query.season);
    if (!idsResult.success) return idsResult;

    const entries =
      query.round != null
        ? idsResult.data.filter((e) => e.roundNumber === query.round)
        : idsResult.data;

    if (entries.length === 0) return ok({ stats: [], failedMatchIds: [] });

    const results = await batchedMap(
      entries,
      (e) => this.client.fetchMatchPlayerStats(e.matchId, query.season, e.roundNumber),
      { batchSize: 5, delayMs: 500 },
    );

    const allStats: PlayerStats[] = [];
    const failedMatchIds: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const entry = entries[i];
      if (result?.success) {
        allStats.push(...result.data);
      } else if (entry) {
        failedMatchIds.push(`FW_${entry.matchId}`);
      }
    }
    return ok({ stats: allStats, failedMatchIds });
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

    const players: Player[] = result.data.map((p) => ({
      playerId: p.playerId,
      givenName: p.givenName,
      surname: p.surname,
      displayName: p.displayName,
      jumperNumber: p.jumperNumber,
      position: p.position,
      dateOfBirth: p.dateOfBirth ?? null,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      draftYear: p.draftYear,
      draftPosition: p.draftPosition,
      draftType: p.draftType,
      debutYear: p.debutYear,
      recruitedFrom: p.recruitedFrom,
      gamesPlayed: p.gamesPlayed ?? null,
      goals: p.goals ?? null,
      team: teamName,
      source: "footywire",
      competition,
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
