/**
 * AFL Tables source adapters.
 *
 * AFL Tables is AFLM-only. Match results go back to 1897; player stats
 * start ~1965. Other capabilities (TeamStats, Ladder via compute) declare
 * their own coverage in their own classes.
 */

import { ok, type Result } from "../../lib/result";
import { normaliseTeamName } from "../../lib/team-mapping";
import { computeLadder } from "../../transforms/computed-ladder";
import type {
  Ladder,
  LadderQuery,
  Match,
  MatchQuery,
  PlayerStats,
  PlayerStatsQuery,
  TeamStatsEntry,
  TeamStatsQuery,
} from "../../types";
import { AflTablesClient } from "../afl-tables";
import type { LadderSource, MatchSource, PlayerStatsSource, TeamStatsSource } from "./capabilities";
import type { CoverageMap } from "./coverage";

const AFL_TABLES_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);
const AFL_TABLES_PLAYER_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1965 }]]);
const AFL_TABLES_TEAM_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1965 }]]);
const AFL_TABLES_LADDER_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);

/** AFL Tables as a MatchSource (AFLM only, 1897+). */
export class AflTablesMatchSource implements MatchSource {
  readonly id = "afl-tables" as const;
  readonly coverage = AFL_TABLES_MATCH_COVERAGE;

  constructor(private readonly client: AflTablesClient = new AflTablesClient()) {}

  async fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
    const result = await this.client.fetchSeasonResults(query.season);
    if (!result.success) return result;
    const filtered =
      query.round != null ? result.data.filter((m) => m.roundNumber === query.round) : result.data;
    return ok(filtered);
  }
}

/** AFL Tables as a PlayerStatsSource (AFLM only, ~1965+). */
export class AflTablesPlayerStatsSource implements PlayerStatsSource {
  readonly id = "afl-tables" as const;
  readonly coverage = AFL_TABLES_PLAYER_STATS_COVERAGE;

  constructor(private readonly client: AflTablesClient = new AflTablesClient()) {}

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<PlayerStats[], Error>> {
    const result = await this.client.fetchSeasonPlayerStats(query.season);
    if (!result.success) return result;
    if (query.round != null) {
      return ok(result.data.filter((s) => s.roundNumber === query.round));
    }
    return result;
  }
}

/** AFL Tables as a TeamStatsSource. */
export class AflTablesTeamStatsSource implements TeamStatsSource {
  readonly id = "afl-tables" as const;
  readonly coverage = AFL_TABLES_TEAM_STATS_COVERAGE;

  constructor(private readonly client: AflTablesClient = new AflTablesClient()) {}

  async fetchTeamStats(query: TeamStatsQuery): Promise<Result<TeamStatsEntry[], Error>> {
    const summaryType = query.summaryType ?? "totals";
    const statsResult = await this.client.fetchTeamStats(query.season);
    if (!statsResult.success) return statsResult;

    // The stats page lacks a GP column — derive from match results if needed.
    const needsGp = statsResult.data.some((e) => e.gamesPlayed === 0);
    const gpMap = new Map<string, number>();
    if (needsGp) {
      const resultsResult = await this.client.fetchSeasonResults(query.season);
      if (resultsResult.success) {
        for (const m of resultsResult.data) {
          const home = normaliseTeamName(m.homeTeam);
          const away = normaliseTeamName(m.awayTeam);
          gpMap.set(home, (gpMap.get(home) ?? 0) + 1);
          gpMap.set(away, (gpMap.get(away) ?? 0) + 1);
        }
      }
    }

    const enriched = statsResult.data.map((entry) => ({
      ...entry,
      gamesPlayed: gpMap.get(normaliseTeamName(entry.team)) ?? entry.gamesPlayed,
    }));

    if (summaryType === "averages") {
      return ok(
        enriched.map((entry) => ({
          ...entry,
          stats: Object.fromEntries(
            Object.entries(entry.stats).map(([k, v]) => [
              k,
              entry.gamesPlayed > 0 ? +(v / entry.gamesPlayed).toFixed(1) : 0,
            ]),
          ),
        })),
      );
    }
    return ok(enriched);
  }
}

/**
 * AFL Tables as a LadderSource — *computed* from match results.
 *
 * AFL Tables doesn't publish a ladder endpoint, but match results go back
 * to 1897, so we can synthesise the ladder by accumulating wins/losses/etc.
 * via {@link computeLadder}. Coverage matches the match-results coverage.
 */
export class AflTablesLadderSource implements LadderSource {
  readonly id = "afl-tables" as const;
  readonly coverage = AFL_TABLES_LADDER_COVERAGE;

  constructor(private readonly client: AflTablesClient = new AflTablesClient()) {}

  async fetchLadder(query: LadderQuery): Promise<Result<Ladder, Error>> {
    const competition = query.competition ?? "AFLM";
    const resultsResult = await this.client.fetchSeasonResults(query.season);
    if (!resultsResult.success) return resultsResult;

    const entries = computeLadder(resultsResult.data, query.round ?? undefined);
    return ok({
      season: query.season,
      roundNumber: query.round ?? null,
      entries,
      competition,
    });
  }
}
