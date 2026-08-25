/**
 * AFL Tables source adapters.
 *
 * AFL Tables is AFLM-only. Match results go back to 1897; player stats
 * start ~1965. Other capabilities (TeamStats, Ladder via compute) declare
 * their own coverage in their own classes.
 */

import { ScrapeError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { normaliseTeamName } from "../../lib/team-mapping";
import { computeLadder } from "../../transforms/computed-ladder";
import type {
  Ladder,
  LadderQuery,
  Match,
  MatchQuery,
  Player,
  PlayerStatsQuery,
  SeasonPlayerStats,
  Squad,
  SquadQuery,
  TeamStatsEntry,
  TeamStatsQuery,
} from "../../types";
import { AflTablesClient } from "../afl-tables";
import type {
  LadderSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
  TeamStatsSource,
} from "./capabilities";
import type { CoverageMap } from "./coverage";

const AFL_TABLES_MATCH_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);
const AFL_TABLES_PLAYER_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1965 }]]);
const AFL_TABLES_TEAM_STATS_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1965 }]]);
const AFL_TABLES_LADDER_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);
const AFL_TABLES_SQUAD_COVERAGE: CoverageMap = new Map([["AFLM", { minSeason: 1897 }]]);

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

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<SeasonPlayerStats, Error>> {
    const result = await this.client.fetchSeasonPlayerStats(query.season);
    if (!result.success) return result;
    if (query.round != null) {
      // failedMatchIds pass through unfiltered — a failed game's round is
      // unknown, so callers see every season-scrape failure regardless of
      // the round filter.
      return ok({
        stats: result.data.stats.filter((s) => s.roundNumber === query.round),
        failedMatchIds: result.data.failedMatchIds,
      });
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
    const needsGp = statsResult.data.some((entry) => entry.gamesPlayed === null);
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
      const invalid = enriched.filter(
        (entry) => entry.gamesPlayed === null || entry.gamesPlayed <= 0,
      );
      if (invalid.length > 0) {
        return err(
          new ScrapeError(
            `Cannot calculate team-stat averages because games played is missing or non-positive for: ${invalid.map((entry) => entry.team).join(", ")}`,
            "afl-tables",
          ),
        );
      }
      return ok(enriched.map((entry) => averageMetrics(entry)));
    }
    return ok(enriched);
  }
}

/** Convert a TeamStatsEntry's `for`/`against` totals into per-game averages. */
function averageMetrics(entry: TeamStatsEntry): TeamStatsEntry {
  const gamesPlayed = entry.gamesPlayed;
  if (gamesPlayed === null || gamesPlayed <= 0) return entry;
  const divide = (set: TeamStatsEntry["for"]): TeamStatsEntry["for"] => {
    const out = { ...set };
    for (const key of Object.keys(out) as (keyof typeof out)[]) {
      const v = out[key];
      if (v != null) {
        out[key] = +(v / gamesPlayed).toFixed(1);
      }
    }
    return out;
  };
  return { ...entry, for: divide(entry.for), against: divide(entry.against) };
}

/**
 * AFL Tables as a SquadSource — scrapes the team page for the **all-time
 * roster**, NOT a per-season squad. AFL Tables doesn't publish per-season
 * squad lists, so the `season` field is stamped onto the response for
 * cross-source compatibility but does not actually filter the player list.
 *
 * **Caveat for callers (#88):** asking for `season: 1900` and `season: 2024`
 * returns the same all-time list. If you need an accurate seasonal squad,
 * use `--source afl-api` (2012+ only). For pre-2012 seasons the all-time
 * roster is the only available proxy.
 */
export class AflTablesSquadSource implements SquadSource {
  readonly id = "afl-tables" as const;
  readonly coverage = AFL_TABLES_SQUAD_COVERAGE;

  constructor(private readonly client: AflTablesClient = new AflTablesClient()) {}

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
      source: "afl-tables",
      competition,
    }));

    return ok({
      teamId: teamName,
      teamName,
      season: query.season,
      scope: "all-time",
      players,
      competition,
      source: "afl-tables" as const,
    });
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
    // Surface the most-recent completed match feeding the synthesised
    // ladder so mid-round snapshots are pinned to a specific cutoff (#119).
    const roundCutoff = query.round;
    const inScope =
      roundCutoff != null
        ? resultsResult.data.filter((m) => m.roundNumber <= roundCutoff)
        : resultsResult.data;
    const completed = inScope.filter((m) => m.status === "Complete");
    completed.sort((a, b) => b.date.getTime() - a.date.getTime());
    const asOfMatch = completed[0]?.matchId ?? null;

    return ok({
      season: query.season,
      roundNumber: query.round ?? null,
      entries,
      competition,
      source: "afl-tables" as const,
      asOfMatch,
    });
  }
}
