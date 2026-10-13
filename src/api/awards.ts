import { canonicalSeasonKey, seasonYear } from "../lib/seasons";
/**
 * Public API for fetching AFL season-recognition data.
 *
 * Awards is concept-first, not source-first: `fetchAwards` dispatches on the
 * `award` type to either *fetch* (Brownlow, Coaches votes, All-Australian,
 * Rising Star) or *compute* (Coleman from PlayerStats). The source
 * heterogeneity is hidden from the caller.
 */

import { Effect } from "effect";
import { ScrapeError, type SourceError } from "../lib/errors";
import { normaliseTeamName } from "../lib/team-mapping";
import { AflCoaches, isFinalsRound } from "../sources/afl-coaches";
import type { SourceRegistry } from "../sources/adapters/index";
import { FootyWire } from "../sources/footywire";
import {
  parseAllAustralian,
  parseBrownlowVotes,
  parseRisingStarNominations,
} from "../transforms/awards";
import type {
  Award,
  AwardQuery,
  AwardResult,
  CoachesVote,
  ColemanLeader,
  CompetitionCode,
  PlayerStats,
} from "../types";
import { fetchMatches } from "./match";
import { fetchPlayerStats } from "./player-stats";

const FOOTYWIRE_BASE = "https://www.footywire.com/afl/footy";

/**
 * Fetch awards data for a season.
 *
 * @param query - Award type and season; some award types accept additional
 * filters (see {@link AwardQuery}).
 * @returns Award rows and any coaches rounds that failed.
 *
 * @example
 * ```ts
 * yield* fetchAwards({ award: "brownlow", season: 2023 });
 * yield* fetchAwards({ award: "coleman", season: 2024, limit: 10 });
 * yield* fetchAwards({ award: "coaches", season: 2024, round: 3 });
 * ```
 */
export function fetchAwards(
  query: AwardQuery,
): Effect.Effect<AwardResult, SourceError, AwardServices> {
  return Effect.gen(function* () {
    yield* Effect.fromResult(canonicalSeasonKey(query.competition ?? "AFLM", query.season));
    const result = yield* fetchAwardsRaw(query);

    return {
      awards: applyAwardFilters(result.awards, query).map((row) => ({
        ...row,
        seasonKey: String(query.season),
      })),
      failedRounds: result.failedRounds,
    };
  });
}

/** Services the award queries read from. */
export type AwardServices = FootyWire | AflCoaches | SourceRegistry;

function fetchAwardsRaw(query: AwardQuery): Effect.Effect<AwardResult, SourceError, AwardServices> {
  // FootyWire-scraped award pages cover AFLM only. Reject non-AFLM
  // requests up front instead of silently returning AFLM data (#82).
  const isFootyWireScraped =
    query.award === "brownlow" || query.award === "all-australian" || query.award === "rising-star";

  const competition = query.competition ?? "AFLM";

  if (isFootyWireScraped && competition !== "AFLM") {
    return Effect.fail(
      new ScrapeError({
        message: `${query.award} is only available for AFLM via the FootyWire scraper. ${competition} awards are not yet supported.`,
        source: "footywire",
      }),
    );
  }

  switch (query.award) {
    case "brownlow":
      return withCompleteAwardResult(
        fetchFootyWireAward(
          `${FOOTYWIRE_BASE}/brownlow_medal?year=${seasonYear(query.season)}`,
          (html) => parseBrownlowVotes(html, seasonYear(query.season), competition),
          "Brownlow",
          seasonYear(query.season),
        ),
      );

    case "all-australian":
      return withCompleteAwardResult(
        fetchFootyWireAward(
          `${FOOTYWIRE_BASE}/all_australian_selection?year=${seasonYear(query.season)}`,
          (html) => parseAllAustralian(html, seasonYear(query.season), competition),
          "All-Australian",
          seasonYear(query.season),
        ),
      );

    case "rising-star":
      return withCompleteAwardResult(
        fetchFootyWireAward(
          `${FOOTYWIRE_BASE}/rising_star_nominations?year=${seasonYear(query.season)}`,
          (html) => parseRisingStarNominations(html, seasonYear(query.season), competition),
          "Rising Star",
          seasonYear(query.season),
        ),
      );

    case "coaches":
      return fetchCoachesVotes(query);

    case "coleman":
      return withCompleteAwardResult(fetchColemanLeaderboard(query));

    default:
      return Effect.fail(
        new ScrapeError({
          message: `Unknown award type: ${(query as AwardQuery).award}`,
          source: "footywire",
        }),
      );
  }
}

function withCompleteAwardResult<R>(
  result: Effect.Effect<Award[], SourceError, R>,
): Effect.Effect<AwardResult, SourceError, R> {
  return Effect.map(result, (awards) => ({ awards, failedRounds: [] }));
}

/**
 * Apply `--team` and `--limit` filters that the per-award branches don't
 * already apply themselves (coaches applies team; coleman applies limit).
 * Idempotent — safe to call after branches that have already filtered.
 */
function applyAwardFilters(entries: readonly Award[], query: AwardQuery): Award[] {
  let result: readonly Award[] = entries;

  if (query.team != null) {
    const target = normaliseTeamName(query.team);
    result = result.filter((entry) => awardEntryTeamMatches(entry, target));
  }

  if (query.limit != null) {
    result = result.slice(0, query.limit);
  }

  return [...result];
}

/**
 * Test whether an Award entry references the given (already-normalised)
 * team. Awards have heterogeneous team fields — Brownlow has `team`, Coaches
 * has `homeTeam`/`awayTeam`, Coleman has `team`, RisingStar has `team`,
 * AllAustralian has `team`.
 */
function awardEntryTeamMatches(entry: Award, normalisedTarget: string): boolean {
  if ("team" in entry && entry.team != null) {
    return normaliseTeamName(entry.team) === normalisedTarget;
  }

  if ("homeTeam" in entry && "awayTeam" in entry) {
    return (
      normaliseTeamName(entry.homeTeam) === normalisedTarget ||
      normaliseTeamName(entry.awayTeam) === normalisedTarget
    );
  }

  return false;
}

/** Fetch a FootyWire award page and apply its parser. */
function fetchFootyWireAward(
  url: string,
  parse: (html: string) => Award[],
  label: string,
  season: number,
): Effect.Effect<Award[], SourceError, FootyWire> {
  return Effect.gen(function* () {
    const footyWire = yield* FootyWire;
    const data = parse(yield* footyWire.fetchPage(url));

    if (data.length === 0) {
      return yield* Effect.fail(
        new ScrapeError({
          message: `No ${label} data found for season ${season}`,
          source: "footywire",
        }),
      );
    }

    return data;
  });
}

/**
 * Fetch AFLCA coaches votes (folded in from the deprecated `fetchCoachesVotes`).
 *
 * Available from ~2006 for AFLM and ~2018 for AFLW.
 */
function fetchCoachesVotes(query: AwardQuery): Effect.Effect<AwardResult, SourceError, AflCoaches> {
  return Effect.gen(function* () {
    const competition = query.competition ?? "AFLM";

    if (seasonYear(query.season) < 2006) {
      return yield* Effect.fail(
        new ScrapeError({
          message: "No coaches votes data available before 2006",
          source: "afl-coaches",
        }),
      );
    }

    if (competition === "AFLW" && seasonYear(query.season) < 2018) {
      return yield* Effect.fail(
        new ScrapeError({
          message: "No AFLW coaches votes data available before 2018",
          source: "afl-coaches",
        }),
      );
    }

    if (competition === "VFL" || competition === "VFLW") {
      return yield* Effect.fail(
        new ScrapeError({
          message: `No coaches votes data available for ${competition}`,
          source: "afl-coaches",
        }),
      );
    }

    if (String(query.season).includes("-S"))
      return yield* Effect.fail(
        new ScrapeError({
          message: "Coaches votes do not expose a verified selector for separate AFLW 2022 seasons",
          source: "afl-coaches",
        }),
      );
    const client = yield* AflCoaches;
    let votes: readonly CoachesVote[];
    let failedRounds: readonly number[];

    if (query.round != null) {
      votes = yield* client.scrapeRoundVotes(
        seasonYear(query.season),
        query.round,
        competition,
        isFinalsRound(seasonYear(query.season), query.round),
      );

      failedRounds = [];
    } else {
      const season = yield* client.fetchSeasonVotes(seasonYear(query.season), competition);

      votes = season.votes;
      failedRounds = season.failedRounds;
    }

    if (query.team != null) {
      const target = normaliseTeamName(query.team);
      votes = votes.filter(
        (v) => normaliseTeamName(v.homeTeam) === target || normaliseTeamName(v.awayTeam) === target,
      );
    }

    return { awards: [...votes], failedRounds };
  });
}

/**
 * Compute the Coleman Medal leaderboard from PlayerStats.
 *
 * The Coleman Medal is the AFL's award for the leading goal-kicker in the
 * home-and-away season. We sum `goals` per player across the season's matches
 * and rank descending. Ties share the same `position`.
 */
function fetchColemanLeaderboard(
  query: AwardQuery,
): Effect.Effect<Award[], SourceError, SourceRegistry> {
  return Effect.gen(function* () {
    const competition = query.competition ?? "AFLM";

    if (competition === "VFL" || competition === "VFLW") {
      return yield* Effect.fail(
        new ScrapeError({
          message: `Coleman Medal is not awarded in ${competition}; use Coleman-equivalent stats query`,
          source: "afl-api",
        }),
      );
    }

    const [matches, stats] = yield* Effect.all(
      [
        fetchMatches({
          source: "afl-api",
          season: query.season,
          competition,
          status: "Complete",
        }),
        fetchPlayerStats({
          source: "afl-api",
          season: query.season,
          competition,
        }),
      ],
      { concurrency: 2 },
    );

    const homeAndAwayMatchIds = new Set(
      matches.filter((match) => match.roundType === "HomeAndAway").map((match) => match.matchId),
    );

    return rankColemanFromStats(
      stats.stats.filter((stats) => homeAndAwayMatchIds.has(stats.matchId)),
      seasonYear(query.season),
      competition,
    );
  });
}

/** Pure transform: PlayerStats[] → ranked ColemanLeader[]. */
export function rankColemanFromStats(
  stats: readonly PlayerStats[],
  season: number,
  competition: CompetitionCode,
  limit?: number,
): ColemanLeader[] {
  const accumulator = new Map<
    string,
    { player: string; team: string; goals: number; gamesPlayed: number }
  >();

  for (const s of stats) {
    if (s.goals == null) continue;
    const key = s.playerId;
    const existing = accumulator.get(key);

    if (existing) {
      existing.goals += s.goals;
      existing.gamesPlayed += 1;
    } else {
      accumulator.set(key, {
        player: s.displayName,
        team: s.team,
        goals: s.goals,
        gamesPlayed: 1,
      });
    }
  }

  const ranked = [...accumulator.values()]
    .filter((entry) => entry.goals > 0)
    .sort((a, b) => b.goals - a.goals);

  let lastGoals = -1;
  let lastRank = 0;

  const leaderboard: ColemanLeader[] = ranked.map((entry, index) => {
    const rank = entry.goals === lastGoals ? lastRank : index + 1;
    lastGoals = entry.goals;
    lastRank = rank;

    return {
      type: "coleman" as const,
      season,
      competition,
      source: "afl-api" as const,
      rank,
      player: entry.player,
      team: entry.team,
      goals: entry.goals,
      gamesPlayed: entry.gamesPlayed,
    };
  });

  return limit != null ? leaderboard.slice(0, limit) : leaderboard;
}
