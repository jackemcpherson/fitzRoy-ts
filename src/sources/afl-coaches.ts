/**
 * AFL Coaches Association scraper client for AFLCA coaches votes.
 *
 * Scrapes HTML from aflcoaches.com.au using Cheerio, following the same
 * approach as the R package's `scrape_coaches_votes` helper.
 */

import { ScrapeError } from "../lib/errors";
import { parseHtml } from "../lib/parse-html";
import { err, ok, type Result } from "../lib/result";
import { createSourceFetch, type SourceFetchOptions } from "../lib/source-fetch";
import type { CoachesVote, CompetitionCode } from "../types";

/**
 * Final home-and-away round per AFLM season on aflcoaches.com.au.
 *
 * Sourced by `scripts/probe-afl-coaches.ts` on 2026-07-02.
 * Seasons not listed use {@link DEFAULT_LAST_HA_ROUND}.
 *
 * Evidence: for each entry, the Gary Ayres (finals) URL shows a large jump
 * in vote-row count at the round AFTER the value listed here, confirming
 * that listed round is the last H&A round. See the probe script for detail.
 *
 * Maintenance: add one entry when a new season's H&A round count differs
 * from {@link DEFAULT_LAST_HA_ROUND} (same class as `FRYZIGG_LATEST_SNAPSHOT`).
 */
const AFLM_LAST_HA_ROUND: ReadonlyMap<number, number> = new Map([
  // Pre-2011: AFL ran 22 H&A rounds. Probe confirmed 2010; assumed for 2006–2009.
  [2006, 22],
  [2007, 22],
  [2008, 22],
  [2009, 22],
  [2010, 22],
  // 2011: 24 H&A rounds — Gold Coast joined (17 teams); H&A URL returns DATA at
  // round 24 and HTTP 404 at round 25 (probe confirmed 2026-07-02). Gary Ayres
  // returns empty for all rounds (pre-2018 behaviour — no usable finals signal).
  [2011, 24],
  // 2023: 24 H&A rounds — Gary Ayres jump at round 25 (probe confirmed).
  [2023, 24],
  // 2024–2025: 25 H&A rounds — Gary Ayres jump at round 26 (probe confirmed).
  [2024, 25],
  [2025, 25],
]);

/**
 * Default last home-and-away round for AFLM seasons not listed in
 * {@link AFLM_LAST_HA_ROUND}. Covers 2012–2022 (probe confirmed 2012, 2015, 2017, 2019).
 */
const DEFAULT_LAST_HA_ROUND = 23;

/**
 * Returns `true` if the given round is a finals round for AFLM.
 *
 * Uses a per-season lookup table derived from live probes of aflcoaches.com.au
 * rather than the former hardcoded `round >= 24 && season >= 2018` expression,
 * which misclassified round-24 H&A games in 2023+ as finals.
 *
 * For AFLW, `isFinals` is irrelevant (single URL), so this helper is only
 * meaningful for AFLM callers.
 *
 * @param season - Season year (e.g. 2024).
 * @param round - Round number.
 * @returns `true` if `round` exceeds the last home-and-away round for that season.
 */
export function isFinalsRound(season: number, round: number): boolean {
  const lastHa = AFLM_LAST_HA_ROUND.get(season) ?? DEFAULT_LAST_HA_ROUND;
  return round > lastHa;
}

/** Options for constructing an AFL Coaches client. */
export interface AflCoachesClientOptions extends SourceFetchOptions {
  readonly fetchFn?: typeof fetch | undefined;
}

/**
 * AFL Coaches Association scraper client.
 *
 * Scrapes the AFLCA website for coaches votes data.
 */
export class AflCoachesClient {
  private readonly fetchFn: typeof fetch;

  constructor(options?: AflCoachesClientOptions) {
    this.fetchFn = createSourceFetch(options);
  }

  /**
   * Fetch the HTML content of an AFLCA page.
   */
  private async fetchHtml(url: string): Promise<Result<string, ScrapeError>> {
    try {
      const response = await this.fetchFn(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        return err(
          new ScrapeError(`AFL Coaches request failed: ${response.status} (${url})`, "afl-coaches"),
        );
      }

      const html = await response.text();
      return ok(html);
    } catch (cause) {
      return err(
        new ScrapeError(
          `AFL Coaches request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "afl-coaches",
        ),
      );
    }
  }

  /**
   * Build the AFLCA leaderboard URL for a given season, round, and competition.
   *
   * Mirrors the R package URL construction from `helper-aflcoaches.R`.
   *
   * @param season - Season year (e.g. 2024).
   * @param roundNumber - Round number.
   * @param competition - "AFLM" or "AFLW".
   * @param isFinals - Whether this is a finals round.
   */
  private buildUrl(
    season: number,
    roundNumber: number,
    competition: CompetitionCode,
    isFinals: boolean,
  ): string {
    const linkBase =
      competition === "AFLW"
        ? "https://aflcoaches.com.au/awards/aflw-champion-player-of-the-year-award/leaderboard/"
        : isFinals
          ? "https://aflcoaches.com.au/awards/gary-ayres-award-best-finals-player/leaderboard/"
          : "https://aflcoaches.com.au/awards/the-aflca-champion-player-of-the-year-award/leaderboard/";

    const compSuffix = competition === "AFLW" ? "02" : "01";

    // The R package uses season+1 for seasons >= 2023
    const secondPart = season >= 2023 ? season + 1 : season;

    const roundPad = String(roundNumber).padStart(2, "0");

    return `${linkBase}${season}/${secondPart}${compSuffix}${roundPad}`;
  }

  /**
   * Scrape coaches votes for a single round.
   *
   * @param season - Season year.
   * @param roundNumber - Round number.
   * @param competition - "AFLM" or "AFLW".
   * @param isFinals - Whether this is a finals round.
   * @returns Array of coaches vote records for that round.
   */
  async scrapeRoundVotes(
    season: number,
    roundNumber: number,
    competition: CompetitionCode,
    isFinals: boolean,
  ): Promise<Result<CoachesVote[], ScrapeError>> {
    const url = this.buildUrl(season, roundNumber, competition, isFinals);
    const htmlResult = await this.fetchHtml(url);

    if (!htmlResult.success) {
      return htmlResult;
    }

    try {
      const votes = parseCoachesVotesHtml(htmlResult.data, season, roundNumber, competition);
      return ok(votes);
    } catch (cause) {
      return err(
        new ScrapeError(
          `Failed to parse coaches votes: ${cause instanceof Error ? cause.message : String(cause)}`,
          "afl-coaches",
        ),
      );
    }
  }

  /**
   * Fetch coaches votes for an entire season (all rounds).
   *
   * Iterates over rounds 1-30, skipping rounds that return errors (e.g. byes or
   * rounds that haven't been played yet). Finals rounds (>= 24) use the finals URL.
   *
   * @param season - Season year.
   * @param competition - "AFLM" or "AFLW".
   * @returns Combined array of coaches votes for the season.
   */
  async fetchSeasonVotes(
    season: number,
    competition: CompetitionCode,
  ): Promise<Result<CoachesVote[], ScrapeError>> {
    const allVotes: CoachesVote[] = [];
    const maxRound = 30;

    for (let round = 1; round <= maxRound; round++) {
      const isFinals = isFinalsRound(season, round);

      const result = await this.scrapeRoundVotes(season, round, competition, isFinals);

      if (result.success && result.data.length > 0) {
        allVotes.push(...result.data);
      }
      // Silently skip rounds with errors (no data available)
    }

    if (allVotes.length === 0) {
      return err(new ScrapeError(`No coaches votes found for season ${season}`, "afl-coaches"));
    }

    return ok(allVotes);
  }
}

/**
 * Parse coaches votes from the AFLCA leaderboard HTML.
 *
 * Follows the R package parsing logic:
 * - Home/away teams are extracted from `.club_logo` elements with `title` attributes
 * - Votes are extracted from `.col-2` elements within `.votes-by-match` sections
 * - Player names are extracted from `.col-10` elements
 * - Match boundaries are detected by "Votes" / "Player (Club)" header rows
 *
 * @param html - Raw HTML from the AFLCA leaderboard page.
 * @param season - Season year for metadata.
 * @param roundNumber - Round number for metadata.
 * @returns Array of coaches vote records.
 */
export function parseCoachesVotesHtml(
  html: string,
  season: number,
  roundNumber: number,
  competition: CompetitionCode,
): CoachesVote[] {
  const $ = parseHtml(html);

  // Extract team logos (home teams are odd-indexed, away teams are even-indexed)
  const clubLogos = $(".pr-md-3.votes-by-match .club_logo");
  const homeTeams: string[] = [];
  const awayTeams: string[] = [];

  clubLogos.each((i, el) => {
    const title = $(el).attr("title") ?? "";
    if (i % 2 === 0) {
      homeTeams.push(title);
    } else {
      awayTeams.push(title);
    }
  });

  // Extract votes and player names
  const rawVotes: string[] = [];
  $(".pr-md-3.votes-by-match .col-2").each((_i, el) => {
    const text = $(el).text().replace(/\n/g, "").replace(/\t/g, "").trim();
    rawVotes.push(text);
  });

  const rawPlayers: string[] = [];
  $(".pr-md-3.votes-by-match .col-10").each((_i, el) => {
    const text = $(el).text().replace(/\n/g, "").replace(/\t/g, "").trim();
    rawPlayers.push(text);
  });

  // Build the votes array, using the header rows to delineate matches
  const votes: CoachesVote[] = [];
  let matchIndex = 0;

  for (let i = 0; i < rawPlayers.length; i++) {
    const playerName = rawPlayers[i] ?? "";
    const voteText = rawVotes[i] ?? "";

    // Header rows contain "Player (Club)" and "Votes"
    if (playerName === "Player (Club)" && voteText === "Votes") {
      matchIndex++;
      continue;
    }

    const homeTeam = homeTeams[matchIndex - 1];
    const awayTeam = awayTeams[matchIndex - 1];

    if (homeTeam == null || awayTeam == null) {
      continue;
    }

    const voteCount = Number(voteText);
    if (Number.isNaN(voteCount)) {
      continue;
    }

    votes.push({
      type: "coaches",
      season,
      competition,
      source: "afl-coaches",
      round: roundNumber,
      homeTeam,
      awayTeam,
      player: playerName,
      votes: voteCount,
    });
  }

  return votes;
}
