/**
 * FootyWire scraper client for match results and player statistics.
 *
 * Parses HTML from footywire.com using Cheerio. Used as a fallback source
 * when AFL API data is delayed or unavailable.
 */

import * as cheerio from "cheerio";
import { parseFootyWireDate } from "../lib/date-utils";
import { ScrapeError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchResult } from "../types";

const FOOTYWIRE_BASE = "https://www.footywire.com/afl/footy";

/** Options for constructing a FootyWire client. */
export interface FootyWireClientOptions {
  readonly fetchFn?: typeof fetch | undefined;
}

/**
 * FootyWire scraper client.
 */
export class FootyWireClient {
  private readonly fetchFn: typeof fetch;

  constructor(options?: FootyWireClientOptions) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  /**
   * Fetch the HTML content of a FootyWire page.
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
          new ScrapeError(`FootyWire request failed: ${response.status} (${url})`, "footywire"),
        );
      }

      const html = await response.text();
      return ok(html);
    } catch (cause) {
      return err(
        new ScrapeError(
          `FootyWire request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "footywire",
        ),
      );
    }
  }

  /**
   * Fetch season match results from FootyWire.
   *
   * @param year - The season year.
   * @returns Array of match results.
   */
  async fetchSeasonResults(year: number): Promise<Result<MatchResult[], ScrapeError>> {
    const url = `${FOOTYWIRE_BASE}/ft_match_list?year=${year}`;
    const htmlResult = await this.fetchHtml(url);

    if (!htmlResult.success) {
      return htmlResult;
    }

    try {
      const results = parseMatchList(htmlResult.data, year);
      return ok(results);
    } catch (cause) {
      return err(
        new ScrapeError(
          `Failed to parse match list: ${cause instanceof Error ? cause.message : String(cause)}`,
          "footywire",
        ),
      );
    }
  }
}

/**
 * Parse FootyWire match list HTML into MatchResult objects.
 */
export function parseMatchList(html: string, year: number): MatchResult[] {
  const $ = cheerio.load(html);
  const results: MatchResult[] = [];
  let currentRound = 0;

  // Each row is either a round header (colspan=7) or a match row
  $("tr").each((_i, row) => {
    const roundHeader = $(row).find("td[colspan='7']");
    if (roundHeader.length > 0) {
      const text = roundHeader.text().trim();
      const roundMatch = /Round\s+(\d+)/i.exec(text);
      if (roundMatch?.[1]) {
        currentRound = Number.parseInt(roundMatch[1], 10);
      }
      return;
    }

    const cells = $(row).find("td.data");
    if (cells.length < 5) return;

    // Cell 0: date, Cell 1: teams, Cell 2: venue, Cell 3: attendance, Cell 4: score
    const dateText = $(cells[0]).text().trim();
    const teamsCell = $(cells[1]);
    const venue = $(cells[2]).text().trim();
    const attendance = $(cells[3]).text().trim();
    const scoreCell = $(cells[4]);

    // Skip bye rows
    if (venue === "BYE") return;

    // Parse teams
    const teamLinks = teamsCell.find("a");
    if (teamLinks.length < 2) return;
    const homeTeam = normaliseTeamName($(teamLinks[0]).text().trim());
    const awayTeam = normaliseTeamName($(teamLinks[1]).text().trim());

    // Parse score (format: "82-69")
    const scoreText = scoreCell.text().trim();
    const scoreMatch = /(\d+)-(\d+)/.exec(scoreText);
    if (!scoreMatch) return;

    const homePoints = Number.parseInt(scoreMatch[1] ?? "0", 10);
    const awayPoints = Number.parseInt(scoreMatch[2] ?? "0", 10);

    // Parse match ID from score link
    const scoreLink = scoreCell.find("a").attr("href") ?? "";
    const midMatch = /mid=(\d+)/.exec(scoreLink);
    const matchId = midMatch?.[1] ? `FW_${midMatch[1]}` : `FW_${year}_R${currentRound}_${homeTeam}`;

    // Parse date
    const date = parseFootyWireDate(dateText) ?? new Date(year, 0, 1);

    // Estimate goals/behinds (FootyWire only gives total score on this page)
    const homeGoals = Math.floor(homePoints / 6);
    const homeBehinds = homePoints - homeGoals * 6;
    const awayGoals = Math.floor(awayPoints / 6);
    const awayBehinds = awayPoints - awayGoals * 6;

    results.push({
      matchId,
      season: year,
      roundNumber: currentRound,
      roundType: "HomeAndAway",
      date,
      venue,
      homeTeam,
      awayTeam,
      homeGoals,
      homeBehinds,
      homePoints,
      awayGoals,
      awayBehinds,
      awayPoints,
      margin: homePoints - awayPoints,
      q1Home: null,
      q2Home: null,
      q3Home: null,
      q4Home: null,
      q1Away: null,
      q2Away: null,
      q3Away: null,
      q4Away: null,
      status: "Complete",
      attendance: attendance ? Number.parseInt(attendance, 10) || null : null,
      source: "footywire",
      competition: "AFLM",
    });
  });

  return results;
}
