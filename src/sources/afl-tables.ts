/**
 * AFL Tables scraper client for historical season results.
 *
 * Parses HTML from afltables.com using Cheerio. Provides data
 * back to 1897 for historical AFL/VFL results.
 */

import * as cheerio from "cheerio";
import { parseAflTablesDate } from "../lib/date-utils";
import { ScrapeError } from "../lib/errors";
import { err, ok, type Result } from "../lib/result";
import { normaliseTeamName } from "../lib/team-mapping";
import type { MatchResult, QuarterScore } from "../types";

const AFL_TABLES_BASE = "https://afltables.com/afl/seas";

/** Options for constructing an AFL Tables client. */
export interface AflTablesClientOptions {
  readonly fetchFn?: typeof fetch | undefined;
}

/**
 * AFL Tables scraper client.
 */
export class AflTablesClient {
  private readonly fetchFn: typeof fetch;

  constructor(options?: AflTablesClientOptions) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  /**
   * Fetch season match results from AFL Tables.
   *
   * @param year - The season year (1897 to present).
   * @returns Array of match results.
   */
  async fetchSeasonResults(year: number): Promise<Result<MatchResult[], ScrapeError>> {
    const url = `${AFL_TABLES_BASE}/${year}.html`;
    try {
      const response = await this.fetchFn(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!response.ok) {
        return err(
          new ScrapeError(`AFL Tables request failed: ${response.status} (${url})`, "afl-tables"),
        );
      }

      const html = await response.text();
      const results = parseSeasonPage(html, year);
      return ok(results);
    } catch (cause) {
      return err(
        new ScrapeError(
          `AFL Tables request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "afl-tables",
        ),
      );
    }
  }
}

/**
 * Parse AFL Tables season page HTML into MatchResult objects.
 *
 * AFL Tables uses a pair of `<tr>` rows per match within separate `<table>` elements.
 * The first row has the home team, quarter scores, total, date/venue/attendance.
 * The second row has the away team, quarter scores, total, and result text.
 */
export function parseSeasonPage(html: string, year: number): MatchResult[] {
  const $ = cheerio.load(html);
  const results: MatchResult[] = [];
  let currentRound = 0;
  let matchCounter = 0;

  // Find round headers — tables with "Round N" text that aren't match tables
  // Then find match tables (border=1, font style)
  $("table").each((_i, table) => {
    const $table = $(table);
    const text = $table.text().trim();

    // Check if this is a round header
    const roundMatch = /^Round\s+(\d+)/i.exec(text);
    if (roundMatch?.[1] && !$table.attr("border")) {
      currentRound = Number.parseInt(roundMatch[1], 10);
      return;
    }

    // Match tables have border=1 and contain exactly 2 rows
    if ($table.attr("border") !== "1") return;
    const rows = $table.find("tr");
    if (rows.length !== 2) return;

    const homeRow = $(rows[0]);
    const awayRow = $(rows[1]);

    const homeCells = homeRow.find("td");
    const awayCells = awayRow.find("td");
    if (homeCells.length < 4 || awayCells.length < 3) return;

    // Team names are in the first cell as links
    const homeTeam = normaliseTeamName($(homeCells[0]).find("a").text().trim());
    const awayTeam = normaliseTeamName($(awayCells[0]).find("a").text().trim());
    if (!homeTeam || !awayTeam) return;

    // Quarter scores in second cell (format: "3.3  4.3  7.10 12.14")
    const homeQuarters = parseQuarterScores($(homeCells[1]).text());
    const awayQuarters = parseQuarterScores($(awayCells[1]).text());

    // Total score in third cell
    const homePoints = Number.parseInt($(homeCells[2]).text().trim(), 10) || 0;
    const awayPoints = Number.parseInt($(awayCells[2]).text().trim(), 10) || 0;

    // Date and venue from fourth cell of home row
    const infoText = $(homeCells[3]).text().trim();
    const date = parseDateFromInfo(infoText, year);
    const venue = parseVenueFromInfo($(homeCells[3]).html() ?? "");
    const attendance = parseAttendanceFromInfo(infoText);

    // Final quarter gives total goals.behinds
    const homeFinal = homeQuarters[3];
    const awayFinal = awayQuarters[3];

    matchCounter++;

    results.push({
      matchId: `AT_${year}_${matchCounter}`,
      season: year,
      roundNumber: currentRound,
      roundType: "HomeAndAway",
      date,
      venue,
      homeTeam,
      awayTeam,
      homeGoals: homeFinal?.goals ?? 0,
      homeBehinds: homeFinal?.behinds ?? 0,
      homePoints,
      awayGoals: awayFinal?.goals ?? 0,
      awayBehinds: awayFinal?.behinds ?? 0,
      awayPoints,
      margin: homePoints - awayPoints,
      q1Home: homeQuarters[0] ?? null,
      q2Home: homeQuarters[1] ?? null,
      q3Home: homeQuarters[2] ?? null,
      q4Home: homeQuarters[3] ?? null,
      q1Away: awayQuarters[0] ?? null,
      q2Away: awayQuarters[1] ?? null,
      q3Away: awayQuarters[2] ?? null,
      q4Away: awayQuarters[3] ?? null,
      status: "Complete",
      attendance,
      source: "afl-tables",
      competition: "AFLM",
    });
  });

  return results;
}

/**
 * Parse quarter-by-quarter scores from AFL Tables format.
 * Input: "  3.3   4.3  7.10 12.14 "
 * Returns: array of cumulative QuarterScore objects.
 */
function parseQuarterScores(text: string): (QuarterScore | undefined)[] {
  const clean = text.replace(/\u00a0/g, " ").trim();
  const matches = [...clean.matchAll(/(\d+)\.(\d+)/g)];

  return matches.map((m) => {
    const goals = Number.parseInt(m[1] ?? "0", 10);
    const behinds = Number.parseInt(m[2] ?? "0", 10);
    return { goals, behinds, points: goals * 6 + behinds };
  });
}

/** Parse date from the info cell text (e.g. "Thu 07-Mar-2024 7:30 PM Att: ..."). */
function parseDateFromInfo(text: string, year: number): Date {
  // Extract just the date portion before the time/attendance info
  const dateMatch = /(\d{1,2}-[A-Z][a-z]{2}-\d{4})/.exec(text);
  if (dateMatch?.[1]) {
    return parseAflTablesDate(dateMatch[1]) ?? new Date(year, 0, 1);
  }
  return parseAflTablesDate(text) ?? new Date(year, 0, 1);
}

/** Parse venue from the info cell HTML. */
function parseVenueFromInfo(html: string): string {
  const $ = cheerio.load(html);
  const venueLink = $("a[href*='venues']");
  if (venueLink.length > 0) {
    return venueLink.text().trim();
  }
  // Fallback: look for "Venue: " text
  const venueMatch = /Venue:\s*(.+?)(?:<|$)/i.exec(html);
  return venueMatch?.[1]?.trim() ?? "";
}

/** Parse attendance from the info cell text. */
function parseAttendanceFromInfo(text: string): number | null {
  const match = /Att:\s*([\d,]+)/i.exec(text);
  if (!match?.[1]) return null;
  return Number.parseInt(match[1].replace(/,/g, ""), 10) || null;
}
