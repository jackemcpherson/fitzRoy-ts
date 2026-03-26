/**
 * AFL Coaches Association scraper client for AFLCA coaches votes.
 *
 * Scrapes HTML from aflcoaches.com.au using Cheerio, following the same
 * approach as the R package's `scrape_coaches_votes` helper.
 */

import * as cheerio from "cheerio";
import { ScrapeError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import type { CoachesVote, CompetitionCode } from "../types";

/** Options for constructing an AFL Coaches client. */
export interface AflCoachesClientOptions {
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
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
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
      const votes = parseCoachesVotesHtml(htmlResult.data, season, roundNumber);
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
      // Finals start at round 24 for seasons >= 2018
      const isFinals = round >= 24 && season >= 2018;

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
): CoachesVote[] {
  const $ = cheerio.load(html);

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
      season,
      round: roundNumber,
      homeTeam,
      awayTeam,
      playerName,
      votes: voteCount,
    });
  }

  return votes;
}
