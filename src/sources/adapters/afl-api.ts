/**
 * AFL API source adapters.
 *
 * One class per capability (Match, PlayerStats, Squad, Lineup, Ladder)
 * because each capability has its own coverage map. AFL API supports the
 * same season ranges across all of its operations, but per-capability
 * classes keep the design uniform with sources whose coverage *does* vary
 * per operation (e.g., AFL Tables: matches from 1897, stats from ~1965).
 */

import { batchedMap } from "../../lib/concurrency";
import { parseDate } from "../../lib/date-utils";
import { AflApiError, ValidationError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { AFL_API_TEAM_IDS, normaliseTeamName } from "../../lib/team-mapping";
import { transformLadderEntries } from "../../transforms/ladder";
import { transformMatchRoster } from "../../transforms/lineup";
import { inferRoundType, transformMatchItems } from "../../transforms/match-results";
import { transformPlayerStats } from "../../transforms/player-stats";
import type {
  Ladder,
  LadderQuery,
  Lineup,
  LineupQuery,
  Match,
  MatchQuery,
  Player,
  PlayerStats,
  PlayerStatsQuery,
  SeasonPlayerStats,
  Squad,
  SquadQuery,
} from "../../types";
import { AflApiClient } from "../afl-api";
import type {
  LadderSource,
  LineupSource,
  MatchSource,
  PlayerStatsSource,
  SquadSource,
} from "./capabilities";
import type { CoverageMap } from "./coverage";

/** Per-capability coverage shared by every AFL API capability. */
const AFL_API_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 2012 }],
  ["AFLW", { minSeason: 2017 }],
  ["VFL", { minSeason: 2021 }],
  ["VFLW", { minSeason: 2021 }],
]);

/** AFL API as a MatchSource. */
export class AflApiMatchSource implements MatchSource {
  readonly id = "afl-api" as const;
  readonly coverage = AFL_API_COVERAGE;

  constructor(private readonly client: AflApiClient = new AflApiClient()) {}

  async fetchMatches(query: MatchQuery): Promise<Result<Match[], Error>> {
    const competition = query.competition ?? "AFLM";
    const seasonResult = await this.client.resolveCompSeason(competition, query.season);
    if (!seasonResult.success) return seasonResult;

    const includeUpcoming = query.status !== "Complete";
    const itemsResult =
      query.round != null
        ? await this.client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round)
        : await this.client.fetchSeasonMatchItems(seasonResult.data, { includeUpcoming });
    if (!itemsResult.success) return itemsResult;
    return ok(transformMatchItems(itemsResult.data, query.season, competition));
  }
}

/** AFL API as a PlayerStatsSource. */
export class AflApiPlayerStatsSource implements PlayerStatsSource {
  readonly id = "afl-api" as const;
  readonly coverage = AFL_API_COVERAGE;

  constructor(private readonly client: AflApiClient = new AflApiClient()) {}

  async fetchPlayerStats(query: PlayerStatsQuery): Promise<Result<SeasonPlayerStats, Error>> {
    const competition = query.competition ?? "AFLM";

    if (query.matchId) {
      const [rosterResult, statsResult] = await Promise.all([
        this.client.fetchMatchRoster(query.matchId),
        this.client.fetchPlayerStats(query.matchId),
      ]);
      if (!statsResult.success) return statsResult;

      const teamIdMap = new Map<string, string>(AFL_API_TEAM_IDS);
      if (rosterResult.success) {
        const match = rosterResult.data.match;
        teamIdMap.set(match.homeTeamId, normaliseTeamName(match.homeTeam.name));
        teamIdMap.set(match.awayTeamId, normaliseTeamName(match.awayTeam.name));
      }

      return ok({
        stats: transformPlayerStats(statsResult.data, {
          matchId: query.matchId,
          season: query.season,
          roundNumber: query.round ?? 0,
          competition,
          source: "afl-api",
          teamIdMap,
        }),
        failedMatchIds: [],
      });
    }

    const seasonResult = await this.client.resolveCompSeason(competition, query.season);
    if (!seasonResult.success) return seasonResult;

    const matchItemsResult =
      query.round != null
        ? await this.client.fetchRoundMatchItemsByNumber(seasonResult.data, query.round)
        : await this.client.fetchSeasonMatchItems(seasonResult.data);
    if (!matchItemsResult.success) return matchItemsResult;

    const teamIdMap = new Map<string, string>();
    for (const item of matchItemsResult.data) {
      teamIdMap.set(item.match.homeTeamId, item.match.homeTeam.name);
      teamIdMap.set(item.match.awayTeamId, item.match.awayTeam.name);
    }

    const statsResults = await batchedMap(matchItemsResult.data, (item) =>
      this.client.fetchPlayerStats(item.match.matchId),
    );

    // Unlike the scraper sources, a single failed match here fails the whole
    // season — the AFL API is a structured endpoint where per-match failures
    // indicate a real problem rather than routine scrape flakiness, so the
    // envelope's failedMatchIds stays empty for this source.
    const allStats: PlayerStats[] = [];
    for (let i = 0; i < statsResults.length; i++) {
      const statsResult = statsResults[i];
      if (!statsResult?.success) {
        return statsResult ?? err(new AflApiError("Missing stats result"));
      }
      const item = matchItemsResult.data[i];
      if (!item) continue;
      allStats.push(
        ...transformPlayerStats(statsResult.data, {
          matchId: item.match.matchId,
          season: query.season,
          roundNumber: item.round?.roundNumber ?? query.round ?? 0,
          competition,
          source: "afl-api",
          teamIdMap,
          date: parseDate(item.match.utcStartTime) ?? new Date(item.match.utcStartTime),
          homeTeam: normaliseTeamName(item.match.homeTeam.name),
          awayTeam: normaliseTeamName(item.match.awayTeam.name),
        }),
      );
    }

    return ok({ stats: allStats, failedMatchIds: [] });
  }
}

/** AFL API as a SquadSource. */
export class AflApiSquadSource implements SquadSource {
  readonly id = "afl-api" as const;
  readonly coverage = AFL_API_COVERAGE;

  constructor(private readonly client: AflApiClient = new AflApiClient()) {}

  async fetchSquad(query: SquadQuery): Promise<Result<Squad, Error>> {
    const competition = query.competition ?? "AFLM";
    const seasonResult = await this.client.resolveCompSeason(competition, query.season);
    if (!seasonResult.success) return seasonResult;

    const teamIdResult = await this.resolveTeamId(query.team, competition);
    if (!teamIdResult.success) return teamIdResult;

    const squadResult = await this.client.fetchSquad(teamIdResult.data, seasonResult.data);
    if (!squadResult.success) return squadResult;

    const teamName = normaliseTeamName(squadResult.data.squad.team?.name ?? query.team);
    const players: Player[] = squadResult.data.squad.players.map((p) => ({
      playerId: p.player.providerId ?? String(p.player.id),
      givenName: p.player.firstName,
      surname: p.player.surname,
      displayName: `${p.player.firstName} ${p.player.surname}`,
      jumperNumber: p.jumperNumber ?? null,
      position: p.position ?? null,
      dateOfBirth: p.player.dateOfBirth ?? null,
      heightCm: p.player.heightInCm || null,
      weightKg: p.player.weightInKg || null,
      draftYear: p.player.draftYear ? Number.parseInt(p.player.draftYear, 10) || null : null,
      draftPosition: p.player.draftPosition
        ? Number.parseInt(p.player.draftPosition, 10) || null
        : null,
      draftType: p.player.draftType ?? null,
      debutYear: p.player.debutYear ? Number.parseInt(p.player.debutYear, 10) || null : null,
      recruitedFrom: p.player.recruitedFrom ?? null,
      // AFL API squad endpoint doesn't carry career counters
      gamesPlayed: null,
      goals: null,
      team: teamName,
      source: "afl-api",
      competition,
    }));

    return ok({
      teamId: String(teamIdResult.data),
      teamName,
      season: query.season,
      players,
      competition,
    });
  }

  /** Resolve a canonical team name to the AFL API's numeric team ID. */
  private async resolveTeamId(
    teamName: string,
    competition: "AFLM" | "AFLW" | "VFL" | "VFLW",
  ): Promise<Result<number, Error>> {
    const teamsResult = await this.client.fetchTeams(competition);
    if (!teamsResult.success) return teamsResult;

    const normalised = normaliseTeamName(teamName);
    const match = teamsResult.data.find((t) => normaliseTeamName(t.name) === normalised);
    if (!match) {
      return err(new ValidationError(`Team not found in ${competition}: ${teamName}`));
    }
    return ok(match.id);
  }
}

/** AFL API as a LineupSource. */
export class AflApiLineupSource implements LineupSource {
  readonly id = "afl-api" as const;
  readonly coverage = AFL_API_COVERAGE;

  constructor(private readonly client: AflApiClient = new AflApiClient()) {}

  async fetchLineup(query: LineupQuery): Promise<Result<Lineup[], Error>> {
    const competition = query.competition ?? "AFLM";

    if (query.matchId) {
      const rosterResult = await this.client.fetchMatchRoster(query.matchId);
      if (!rosterResult.success) return rosterResult;
      return ok([transformMatchRoster(rosterResult.data, query.season, query.round, competition)]);
    }

    const seasonResult = await this.client.resolveCompSeason(competition, query.season);
    if (!seasonResult.success) return seasonResult;

    const matchItems = await this.client.fetchRoundMatchItemsByNumber(
      seasonResult.data,
      query.round,
    );
    if (!matchItems.success) return matchItems;

    if (matchItems.data.length === 0) {
      return err(new AflApiError(`No matches found for round ${query.round}`));
    }

    const rosterResults = await batchedMap(matchItems.data, (item) =>
      this.client.fetchMatchRoster(item.match.matchId),
    );

    const lineups: Lineup[] = [];
    for (const rosterResult of rosterResults) {
      if (!rosterResult.success) return rosterResult;
      lineups.push(transformMatchRoster(rosterResult.data, query.season, query.round, competition));
    }

    return ok(lineups);
  }
}

/** AFL API as a LadderSource. */
export class AflApiLadderSource implements LadderSource {
  readonly id = "afl-api" as const;
  readonly coverage = AFL_API_COVERAGE;

  constructor(private readonly client: AflApiClient = new AflApiClient()) {}

  async fetchLadder(query: LadderQuery): Promise<Result<Ladder, Error>> {
    const competition = query.competition ?? "AFLM";
    const seasonResult = await this.client.resolveCompSeason(competition, query.season);
    if (!seasonResult.success) return seasonResult;

    const roundsResult = await this.client.resolveRounds(seasonResult.data);
    if (!roundsResult.success) return roundsResult;

    let roundId: number | undefined;
    if (query.round != null) {
      // Honour an explicit round number.
      const round = roundsResult.data.find((r) => r.roundNumber === query.round);
      if (round) {
        roundId = round.id;
      }
    } else {
      // No explicit round — resolve to the latest *completed* H&A round.
      // Finals don't alter the ladder (it's a Home & Away artefact only),
      // so we always anchor the default to H&A. Without this, the AFL API
      // returns a stale early-season snapshot for completed seasons (#90).
      const haRounds = roundsResult.data.filter((r) => inferRoundType(r.name) === "HomeAndAway");
      const now = Date.now();
      const completedHa = haRounds.filter((r) => {
        if (r.utcEndTime == null) return false;
        const end = new Date(r.utcEndTime).getTime();
        return Number.isFinite(end) && end <= now;
      });
      // Sort by roundNumber descending — pick the latest. If no round has
      // ended yet (very early in a season), pass through with no roundId
      // so the API returns whatever it considers current.
      const latest = completedHa.sort((a, b) => b.roundNumber - a.roundNumber)[0];
      if (latest) {
        roundId = latest.id;
      }
    }

    const ladderResult = await this.client.fetchLadder(seasonResult.data, roundId);
    if (!ladderResult.success) return ladderResult;

    const firstLadder = ladderResult.data.ladders[0];
    const entries = firstLadder ? transformLadderEntries(firstLadder.entries) : [];

    return ok({
      season: query.season,
      roundNumber: ladderResult.data.round?.roundNumber ?? null,
      entries,
      competition,
    });
  }
}
