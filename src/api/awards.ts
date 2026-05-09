/**
 * Public API for fetching AFL season-recognition data.
 *
 * Awards is concept-first, not source-first: `fetchAwards` dispatches on the
 * `award` type to either *fetch* (Brownlow, Coaches votes, All-Australian,
 * Rising Star) or *compute* (Coleman from PlayerStats). The source
 * heterogeneity is hidden from the caller.
 */

import { ScrapeError } from "../lib/errors";
import { err, ok, Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import { AflCoachesClient } from "../sources/afl-coaches";
import { FootyWireClient } from "../sources/footywire";
import {
  parseAllAustralian,
  parseBrownlowVotes,
  parseRisingStarNominations,
} from "../transforms/awards";
import type { Award, AwardQuery, ColemanLeader, CompetitionCode, PlayerStats } from "../types";
import { fetchPlayerStats } from "./player-stats";

const FOOTYWIRE_BASE = "https://www.footywire.com/afl/footy";

/**
 * Fetch awards data for a season.
 *
 * @param query - Award type and season; some award types accept additional
 * filters (see {@link AwardQuery}).
 * @returns Array of award entries (discriminated union by `type` field).
 *
 * @example
 * ```ts
 * await fetchAwards({ award: "brownlow", season: 2023 });
 * await fetchAwards({ award: "coleman", season: 2024, limit: 10 });
 * await fetchAwards({ award: "coaches", season: 2024, round: 3 });
 * ```
 */
export async function fetchAwards(query: AwardQuery): Promise<Result<Award[], Error>> {
  const fetched = await fetchAwardsRaw(query);
  return Result.map(fetched, (entries) => applyAwardFilters(entries, query));
}

async function fetchAwardsRaw(query: AwardQuery): Promise<Result<Award[], Error>> {
  // FootyWire-scraped award pages cover AFLM only. Reject non-AFLM
  // requests up front instead of silently returning AFLM data (#82).
  const isFootyWireScraped =
    query.award === "brownlow" || query.award === "all-australian" || query.award === "rising-star";
  const competition = query.competition ?? "AFLM";
  if (isFootyWireScraped && competition !== "AFLM") {
    return err(
      new ScrapeError(
        `${query.award} is only available for AFLM via the FootyWire scraper. ${competition} awards are not yet supported.`,
        "footywire",
      ),
    );
  }

  switch (query.award) {
    case "brownlow":
      return fetchFootyWireAward(
        `${FOOTYWIRE_BASE}/brownlow_medal?year=${query.season}`,
        (html) => parseBrownlowVotes(html, query.season, competition),
        "Brownlow",
        query.season,
      );

    case "all-australian":
      return fetchFootyWireAward(
        `${FOOTYWIRE_BASE}/all_australian_selection?year=${query.season}`,
        (html) => parseAllAustralian(html, query.season, competition),
        "All-Australian",
        query.season,
      );

    case "rising-star":
      return fetchFootyWireAward(
        `${FOOTYWIRE_BASE}/rising_star_nominations?year=${query.season}`,
        (html) => parseRisingStarNominations(html, query.season, competition),
        "Rising Star",
        query.season,
      );

    case "coaches":
      return fetchCoachesVotes(query);

    case "coleman":
      return fetchColemanLeaderboard(query);

    default:
      return err(
        new ScrapeError(`Unknown award type: ${(query as AwardQuery).award}`, "footywire"),
      );
  }
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
async function fetchFootyWireAward(
  url: string,
  parse: (html: string) => Award[],
  label: string,
  season: number,
): Promise<Result<Award[], Error>> {
  const client = new FootyWireClient();
  const htmlResult = await client.fetchPage(url);
  if (!htmlResult.success) return htmlResult;

  const data = parse(htmlResult.data);
  if (data.length === 0) {
    return err(new ScrapeError(`No ${label} data found for season ${season}`, "footywire"));
  }
  return ok(data);
}

/**
 * Fetch AFLCA coaches votes (folded in from the deprecated `fetchCoachesVotes`).
 *
 * Available from ~2006 for AFLM and ~2018 for AFLW.
 */
async function fetchCoachesVotes(query: AwardQuery): Promise<Result<Award[], Error>> {
  const competition = query.competition ?? "AFLM";

  if (query.season < 2006) {
    return err(new ScrapeError("No coaches votes data available before 2006", "afl-coaches"));
  }
  if (competition === "AFLW" && query.season < 2018) {
    return err(new ScrapeError("No AFLW coaches votes data available before 2018", "afl-coaches"));
  }
  if (competition === "VFL" || competition === "VFLW") {
    return err(
      new ScrapeError(`No coaches votes data available for ${competition}`, "afl-coaches"),
    );
  }

  const client = new AflCoachesClient();
  const result =
    query.round != null
      ? await client.scrapeRoundVotes(
          query.season,
          query.round,
          competition,
          query.round >= 24 && query.season >= 2018,
        )
      : await client.fetchSeasonVotes(query.season, competition);

  if (!result.success) return result;

  let votes = result.data;
  if (query.team != null) {
    const target = normaliseTeamName(query.team);
    votes = votes.filter(
      (v) => normaliseTeamName(v.homeTeam) === target || normaliseTeamName(v.awayTeam) === target,
    );
  }
  return ok(votes);
}

/**
 * Compute the Coleman Medal leaderboard from PlayerStats.
 *
 * The Coleman Medal is the AFL's award for the leading goal-kicker in the
 * home-and-away season. We sum `goals` per player across the season's matches
 * and rank descending. Ties share the same `position`.
 */
async function fetchColemanLeaderboard(query: AwardQuery): Promise<Result<Award[], Error>> {
  const competition = query.competition ?? "AFLM";
  if (competition === "VFL" || competition === "VFLW") {
    return err(
      new ScrapeError(
        `Coleman Medal is not awarded in ${competition}; use Coleman-equivalent stats query`,
        "afl-api",
      ),
    );
  }

  const statsR = await fetchPlayerStats({
    source: "afl-api",
    season: query.season,
    competition,
  });
  return Result.map(statsR, (stats) =>
    rankColemanFromStats(stats, query.season, competition, query.limit),
  );
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
      rank,
      player: entry.player,
      team: entry.team,
      goals: entry.goals,
      gamesPlayed: entry.gamesPlayed,
    };
  });

  return limit != null ? leaderboard.slice(0, limit) : leaderboard;
}
