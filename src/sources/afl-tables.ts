/**
 * AFL Tables scraper client for historical season results.
 *
 * Parses HTML from afltables.com using Cheerio. Provides data
 * back to 1897 for historical AFL/VFL results.
 */

import { batchedMap } from "../lib/concurrency";
import { localToUtc, parseDate } from "../lib/date-utils";
import { ScrapeError } from "../lib/errors";
import { parseHtml } from "../lib/parse-html";
import { err, ok, type Result } from "../lib/result";
import { createSourceFetch, type SourceFetchOptions } from "../lib/source-fetch";
import { normaliseTeamName } from "../lib/team-mapping";
import { emptyMetricSet } from "../lib/team-metrics";
import { normaliseVenueName } from "../lib/venue-mapping";
import { resolveVenueTimezone } from "../lib/venue-timezones";
import { extractGameUrls, parseAflTablesGameStats } from "../transforms/afl-tables-player-stats";
import { finalsRoundNumber, inferRoundType, toRoundCode } from "../transforms/match-results";
import type {
  Match,
  PlayerDetails,
  PlayerStats,
  QuarterScore,
  RoundType,
  SeasonPlayerStats,
  TeamMetricSet,
  TeamStatsEntry,
} from "../types";

const AFL_TABLES_BASE = "https://afltables.com/afl/seas";

/** Options for constructing an AFL Tables client. */
export interface AflTablesClientOptions extends SourceFetchOptions {
  readonly fetchFn?: typeof fetch | undefined;
}

/**
 * AFL Tables scraper client.
 */
export class AflTablesClient {
  private readonly fetchFn: typeof fetch;

  constructor(options?: AflTablesClientOptions) {
    this.fetchFn = createSourceFetch(options);
  }

  /**
   * Fetch season match results from AFL Tables.
   *
   * @param year - The season year (1897 to present).
   * @returns Array of match results.
   */
  async fetchSeasonResults(year: number): Promise<Result<Match[], ScrapeError>> {
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

  /**
   * Fetch player statistics for an entire season from AFL Tables.
   *
   * Scrapes individual game pages linked from the season page. Individual
   * game failures do not abort the season scrape — they are surfaced in
   * the returned envelope's `failedMatchIds` instead, so callers can tell
   * a complete season apart from a partial one. Failure to fetch the
   * season page itself is still a total `err`.
   *
   * @param year - The season year.
   * @returns Envelope of scraped stats plus the match IDs that failed.
   */
  async fetchSeasonPlayerStats(year: number): Promise<Result<SeasonPlayerStats, ScrapeError>> {
    const seasonUrl = `${AFL_TABLES_BASE}/${year}.html`;
    try {
      const seasonResponse = await this.fetchFn(seasonUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!seasonResponse.ok) {
        return err(
          new ScrapeError(
            `AFL Tables request failed: ${seasonResponse.status} (${seasonUrl})`,
            "afl-tables",
          ),
        );
      }

      const seasonHtml = await seasonResponse.text();
      const gameUrls = extractGameUrls(seasonHtml);

      if (gameUrls.length === 0) {
        return ok({ stats: [], failedMatchIds: [] });
      }

      const results = parseSeasonPage(seasonHtml, year);

      const indexedUrls = gameUrls.map((gameUrl, idx) => ({ gameUrl, idx }));
      const perGame = await batchedMap(
        indexedUrls,
        async ({
          gameUrl,
          idx,
        }): Promise<{ stats: PlayerStats[]; failedMatchId: string | null }> => {
          const urlMatch = /\/(\d+)\.html$/.exec(gameUrl);
          const matchId = urlMatch?.[1] ?? `${year}_${idx}`;
          try {
            const resp = await this.fetchFn(gameUrl, {
              headers: { "User-Agent": "Mozilla/5.0" },
            });
            if (!resp.ok) return { stats: [], failedMatchId: `AT_${matchId}` };

            const html = await resp.text();
            const roundNumber = results[idx]?.roundNumber ?? 0;

            return {
              stats: parseAflTablesGameStats(html, matchId, year, roundNumber),
              failedMatchId: null,
            };
          } catch {
            return { stats: [], failedMatchId: `AT_${matchId}` };
          }
        },
        { batchSize: 5, delayMs: 300 },
      );

      return ok({
        stats: perGame.flatMap((g) => g.stats),
        failedMatchIds: perGame.flatMap((g) => (g.failedMatchId ? [g.failedMatchId] : [])),
      });
    } catch (cause) {
      return err(
        new ScrapeError(
          `AFL Tables player stats failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "afl-tables",
        ),
      );
    }
  }

  /**
   * Fetch team statistics from AFL Tables.
   *
   * Scrapes the season stats page which includes per-team aggregate stats.
   *
   * @param year - The season year.
   * @returns Array of team stats entries.
   */
  async fetchTeamStats(year: number): Promise<Result<TeamStatsEntry[], ScrapeError>> {
    const url = `https://afltables.com/afl/stats/${year}s.html`;
    try {
      const response = await this.fetchFn(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!response.ok) {
        const friendly =
          response.status === 404
            ? `AFL Tables has no team stats for ${year}`
            : `AFL Tables stats request failed: ${response.status}`;
        return err(new ScrapeError(friendly, "afl-tables"));
      }

      const html = await response.text();
      const entries = parseAflTablesTeamStats(html, year);
      return ok(entries);
    } catch (cause) {
      return err(
        new ScrapeError(
          `AFL Tables team stats failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "afl-tables",
        ),
      );
    }
  }

  /**
   * Fetch player list from AFL Tables team page.
   *
   * Scrapes the team index page (e.g. `teams/swans_idx.html`) which lists
   * all players who have played for that team historically.
   *
   * @param teamName - Canonical team name (e.g. "Sydney Swans").
   * @returns Array of player details (without source/competition fields).
   */
  async fetchPlayerList(
    teamName: string,
  ): Promise<Result<Omit<PlayerDetails, "source" | "competition">[], ScrapeError>> {
    const slug = teamNameToAflTablesSlug(teamName);
    if (!slug) {
      return err(new ScrapeError(`No AFL Tables slug mapping for team: ${teamName}`, "afl-tables"));
    }

    const url = `https://afltables.com/afl/stats/alltime/${slug}.html`;
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
      const players = parseAflTablesPlayerList(html, teamName);
      return ok(players);
    } catch (cause) {
      return err(
        new ScrapeError(
          `AFL Tables player list failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "afl-tables",
        ),
      );
    }
  }
}

/**
 * Parse AFL Tables season page HTML into Match objects.
 *
 * AFL Tables uses a pair of `<tr>` rows per match within separate `<table>` elements.
 * The first row has the home team, quarter scores, total, date/venue/attendance.
 * The second row has the away team, quarter scores, total, and result text.
 *
 * @param html - Raw HTML from the AFL Tables season page.
 * @param year - The season year for metadata.
 * @returns Array of match results extracted from the page.
 */
export function parseSeasonPage(html: string, year: number): Match[] {
  const $ = parseHtml(html);
  const results: Match[] = [];
  let currentRound = 0;
  let currentRoundType: RoundType = "HomeAndAway";
  let currentRoundName = "";
  let lastHARound = 0;
  let matchCounter = 0;

  // Find round headers — tables with "Round N" text that aren't match tables
  // Then find match tables (border=1, font style)
  $("table").each((_i, table) => {
    const $table = $(table);
    const text = $table.text().trim();

    // Round headers are in tables with border=2 containing "Round N" text
    const border = $table.attr("border");
    const roundMatch = /^Round\s+(\d+)/i.exec(text);
    if (roundMatch?.[1] && border !== "1") {
      currentRound = Number.parseInt(roundMatch[1], 10);
      currentRoundType = inferRoundType(text);
      currentRoundName = text;
      if (currentRoundType === "HomeAndAway") {
        lastHARound = currentRound;
      }
      return;
    }

    // Check for non-numbered round headers (Finals, Grand Final, etc.)
    if (border !== "1" && inferRoundType(text) === "Finals") {
      currentRoundType = "Finals";
      currentRoundName = text;
      currentRound = finalsRoundNumber(text, lastHARound);
      return;
    }

    // Match tables have border=1 and contain exactly 2 rows
    if (border !== "1") return;
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
    const venue = normaliseVenueName(parseVenueFromInfo($(homeCells[3]).html() ?? ""));
    const venueTimezone = resolveVenueTimezone(venue);
    const date = parseDateFromInfo(infoText, year, venueTimezone);
    const attendance = parseAttendanceFromInfo(infoText);

    // AFL Tables stores quarter scores as running totals; convert to per-quarter
    // so q1+q2+q3+q4 == total (matching afl-api / footywire / squiggle).
    const homePerQuarter = toPerQuarter(homeQuarters);
    const awayPerQuarter = toPerQuarter(awayQuarters);

    // Final quarter gives total goals.behinds
    const homeFinal = homeQuarters[3];
    const awayFinal = awayQuarters[3];

    // Round name and code from the round-header text — strip any trailing
    // "* see notes Rnd Att: ..." footnote / attendance summary the AFL Tables
    // page glues onto the header (#113).
    const cleanRoundName = cleanRoundLabel(currentRoundName);

    matchCounter++;

    results.push({
      matchId: `AT_${year}_${matchCounter}`,
      season: year,
      roundNumber: currentRound,
      roundType: currentRoundType,
      roundName: cleanRoundName || null,
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
      q1Home: homePerQuarter[0] ?? null,
      q2Home: homePerQuarter[1] ?? null,
      q3Home: homePerQuarter[2] ?? null,
      q4Home: homePerQuarter[3] ?? null,
      q1Away: awayPerQuarter[0] ?? null,
      q2Away: awayPerQuarter[1] ?? null,
      q3Away: awayPerQuarter[2] ?? null,
      q4Away: awayPerQuarter[3] ?? null,
      status: "Complete",
      livePeriodStatus: null,
      attendance,
      weatherTempCelsius: null,
      weatherType: null,
      roundCode: toRoundCode(cleanRoundName),
      venueState: null,
      venueTimezone,
      homeRushedBehinds: null,
      awayRushedBehinds: null,
      homeMinutesInFront: null,
      awayMinutesInFront: null,
      source: "afl-tables",
      competition: "AFLM",
    });
  });

  return remapOpeningRound(results, year);
}

/**
 * AFL Tables numbers Opening Round as Round 1 (and the actual season opener as
 * Round 2). The other sources adopt the AFL's convention: Opening Round is
 * round 0, and Round 1 is the proper opener. Detect Opening Round (year ≥
 * 2024 and the first H&A round has fewer than 9 games) and shift all H&A
 * round numbers down by one. Finals round numbering is independent.
 */
function remapOpeningRound(matches: readonly Match[], year: number): Match[] {
  if (year < 2024) return [...matches];

  // Count games in the lowest-numbered H&A round.
  const haRounds = matches.filter((m) => m.roundType === "HomeAndAway");
  if (haRounds.length === 0) return [...matches];
  const minRound = Math.min(...haRounds.map((m) => m.roundNumber));
  const firstRoundGames = haRounds.filter((m) => m.roundNumber === minRound).length;
  if (firstRoundGames >= 9) return [...matches];

  // Opening Round detected — shift all H&A rounds down by 1.
  return matches.map((m) =>
    m.roundType === "HomeAndAway"
      ? {
          ...m,
          roundNumber: m.roundNumber - 1,
          roundName: m.roundNumber === 1 ? "Opening Round" : `Round ${m.roundNumber - 1}`,
          roundCode: m.roundNumber === 1 ? "OR" : `R${m.roundNumber - 1}`,
        }
      : m,
  );
}

/**
 * Convert a sequence of cumulative-total quarter scores into per-quarter
 * scores. AFL Tables' "quarter-by-quarter line score" is cumulative; we
 * normalise so q1+q2+q3+q4 == total (#103).
 */
function toPerQuarter(
  cumulative: readonly (QuarterScore | undefined)[],
): (QuarterScore | undefined)[] {
  const out: (QuarterScore | undefined)[] = [];
  let prevGoals = 0;
  let prevBehinds = 0;
  let prevPoints = 0;
  for (const q of cumulative) {
    if (q == null) {
      out.push(undefined);
      continue;
    }
    out.push({
      goals: q.goals - prevGoals,
      behinds: q.behinds - prevBehinds,
      points: q.points - prevPoints,
    });
    prevGoals = q.goals;
    prevBehinds = q.behinds;
    prevPoints = q.points;
  }
  return out;
}

/**
 * Strip AFL Tables' attendance/footnote suffix from a round-header label.
 * Input: `"Round 1 * see notes Rnd Att: 116,700 (29,175) Tot Att: ..."`
 * Output: `"Round 1"`. Also handles bare finals labels ("Qualifying Final",
 * "Grand Final", etc.) by truncating at the first asterisk or the "Att:"
 * marker, whichever comes first.
 */
function cleanRoundLabel(raw: string): string {
  if (!raw) return "";
  const collapsed = raw.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  // Match leading "Round N" or a finals label.
  const finalsMatch =
    /^(Round\s+\d+|Opening\s+Round|Qualifying\s+Final|Elimination\s+Final|Semi[- ]?Final|Preliminary\s+Final|Grand\s+Final)/i.exec(
      collapsed,
    );
  if (finalsMatch?.[1]) return finalsMatch[1];
  // Fallback: strip everything from the first asterisk or "Att:" onward.
  const cut = collapsed.search(/\s*\*|\s+(?:Rnd|Tot)\s+Att:/i);
  return cut >= 0 ? collapsed.slice(0, cut).trim() : collapsed;
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

/**
 * Parse date (and, when present, time-of-day) from the info cell text
 * (e.g. `"Thu 07-Mar-2024 7:30 PM Att: ..."`). Time-of-day is interpreted
 * in the venue's IANA tz when supplied, falling back to Australia/Melbourne
 * for unknown venues. Previously discarded the time entirely (#104).
 */
function parseDateFromInfo(text: string, year: number, venueTimezone: string | null): Date {
  const m = /(\d{1,2})-([A-Z][a-z]{2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm]))?/.exec(text);
  if (!m) return parseDate(text) ?? new Date(year, 0, 1);

  const day = Number.parseInt(m[1] ?? "0", 10);
  const monthStr = (m[2] ?? "").toLowerCase();
  const yearN = Number.parseInt(m[3] ?? `${year}`, 10);
  const months: Readonly<Record<string, number>> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const monthIndex = months[monthStr];
  if (monthIndex == null) return parseDate(text) ?? new Date(year, 0, 1);

  // No time → midnight UTC (matches AFL Tables' historical convention pre-2010s).
  if (!m[4] || !m[5] || !m[6]) {
    return new Date(Date.UTC(yearN, monthIndex, day));
  }

  let hours = Number.parseInt(m[4], 10);
  const minutes = Number.parseInt(m[5], 10);
  const ampm = m[6].toLowerCase();
  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;

  const tz = venueTimezone ?? "Australia/Melbourne";
  const result = localToUtc(tz, yearN, monthIndex, day, hours, minutes);
  return result.success ? result.data : new Date(Date.UTC(yearN, monthIndex, day));
}

/** Parse venue from the info cell HTML. */
function parseVenueFromInfo(html: string): string {
  const $ = parseHtml(html);
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

/**
 * Parse AFL Tables team statistics summary page.
 *
 * The page at `afltables.com/afl/stats/YYYYs.html` has "Team Totals For" (table 2)
 * and "Team Totals Against" (table 3) — matching the R package which uses
 * `tables[[2]]` and `tables[[3]]` (1-indexed).
 *
 * Each table has headers: Team Totals For/Against, KI, MK, HB, DI, GL, BH, HO, TK,
 * RB, IF, CL, CG, FF, BR, CP, UP, CM, MI, 1%, BO, GA
 *
 * @param html - Raw HTML from the AFL Tables stats summary page.
 * @param year - The season year.
 * @returns Array of team stats entries.
 */
/** Headers that indicate a games-played column. */
const GP_HEADERS = new Set(["gm", "gp", "p", "mp", "games"]);

/** AFL Tables raw header → canonical TeamMetricSet field. (#98) */
const AFL_TABLES_TEAM_METRIC_MAP: Readonly<Record<string, keyof TeamMetricSet>> = {
  KI: "kicks",
  MK: "marks",
  HB: "handballs",
  DI: "disposals",
  GL: "goals",
  BH: "behinds",
  HO: "hitouts",
  TK: "tackles",
  RB: "rebound50s",
  CL: "clearances",
  CG: "clangers",
  FF: "freesFor",
  FA: "freesAgainst",
  BR: "brownlowVotes",
  CP: "contestedPossessions",
  UP: "uncontestedPossessions",
  CM: "contestedMarks",
  MI: "marksInside50",
  "1%": "onePercenters",
  BO: "bounces",
  GA: "goalAssists",
  I50: "inside50s",
};

interface AflTablesTeamData {
  gamesPlayed: number;
  forMetrics: Record<string, number | null>;
  againstMetrics: Record<string, number | null>;
}

export function parseAflTablesTeamStats(html: string, year: number): TeamStatsEntry[] {
  const $ = parseHtml(html);
  const teamMap = new Map<string, AflTablesTeamData>();

  const tables = $("table");

  /** Parse a single stats table into the teamMap. */
  function parseTable(tableIdx: number, direction: "for" | "against"): void {
    if (tableIdx >= tables.length) return;
    const $table = $(tables[tableIdx]);
    const rows = $table.find("tr");
    if (rows.length < 2) return;

    // First row is headers
    const headers: string[] = [];
    $(rows[0])
      .find("td, th")
      .each((_ci, cell) => {
        headers.push($(cell).text().trim());
      });

    // Identify the games-played column index (if any)
    const gpColIdx = headers.findIndex((h, i) => i > 0 && GP_HEADERS.has(h.toLowerCase()));

    for (let ri = 1; ri < rows.length; ri++) {
      const cells = $(rows[ri]).find("td");
      if (cells.length < 3) continue;

      const teamText = $(cells[0]).text().trim();
      if (teamText === "Totals" || !teamText) continue;

      const teamName = normaliseTeamName(teamText);
      if (!teamName) continue;

      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, {
          gamesPlayed: 0,
          forMetrics: { ...emptyMetricSet() },
          againstMetrics: { ...emptyMetricSet() },
        });
      }
      const entry = teamMap.get(teamName);
      if (!entry) continue;

      if (gpColIdx >= 0 && direction === "for") {
        const gpVal = Number.parseFloat($(cells[gpColIdx]).text().trim().replace(/,/g, "")) || 0;
        entry.gamesPlayed = gpVal;
      }

      const target = direction === "for" ? entry.forMetrics : entry.againstMetrics;
      for (let ci = 1; ci < cells.length; ci++) {
        if (ci === gpColIdx) continue;

        const header = headers[ci];
        if (!header) continue;
        const canonical = AFL_TABLES_TEAM_METRIC_MAP[header];
        if (canonical == null) continue; // unknown header — skip
        const value = Number.parseFloat($(cells[ci]).text().trim().replace(/,/g, "")) || 0;
        target[canonical] = value;
      }
    }
  }

  // R package: tables[[2]] = "For", tables[[3]] = "Against" (1-indexed)
  parseTable(1, "for");
  parseTable(2, "against");

  const entries: TeamStatsEntry[] = [];
  for (const [team, data] of teamMap) {
    entries.push({
      season: year,
      competition: "AFLM",
      team,
      gamesPlayed: data.gamesPlayed,
      for: data.forMetrics as unknown as TeamMetricSet,
      against: data.againstMetrics as unknown as TeamMetricSet,
      source: "afl-tables",
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// AFL Tables team slug mapping
// ---------------------------------------------------------------------------

/** Map canonical team names to AFL Tables URL slugs (used in `teams/SLUG_idx.html`). */
const AFL_TABLES_SLUG_MAP: ReadonlyMap<string, string> = new Map([
  ["Adelaide Crows", "adelaide"],
  ["Brisbane Lions", "brisbane"],
  ["Carlton", "carlton"],
  ["Collingwood", "collingwood"],
  ["Essendon", "essendon"],
  ["Fremantle", "fremantle"],
  ["Geelong Cats", "geelong"],
  ["Gold Coast Suns", "goldcoast"],
  ["GWS Giants", "gws"],
  ["Hawthorn", "hawthorn"],
  ["Melbourne", "melbourne"],
  ["North Melbourne", "kangaroos"],
  ["Port Adelaide", "padelaide"],
  ["Richmond", "richmond"],
  ["St Kilda", "stkilda"],
  ["Sydney Swans", "swans"],
  ["West Coast Eagles", "westcoast"],
  ["Western Bulldogs", "bullldogs"],
  ["Fitzroy", "fitzroy"],
  ["University", "university"],
]);

/**
 * Convert a canonical team name to an AFL Tables URL slug.
 *
 * @param teamName - Canonical team name (e.g. "Sydney Swans").
 * @returns The AFL Tables slug or undefined if not found.
 */
function teamNameToAflTablesSlug(teamName: string): string | undefined {
  return AFL_TABLES_SLUG_MAP.get(teamName);
}

/**
 * Parse AFL Tables all-time player list HTML into player detail objects.
 *
 * The page at `stats/alltime/TEAM.html` has a `<table class="sortable">` with columns:
 * Cap, #, Player, DOB, HT, WT, Games (W-D-L), Goals, Seasons, Debut, Last
 *
 * The R package uses `html_table() %>% pluck(1)` and then separates `Games (W-D-L)`.
 *
 * @param html - Raw HTML from the AFL Tables all-time player list page.
 * @param teamName - Canonical team name.
 * @returns Array of player details.
 */
function parseAflTablesPlayerList(
  html: string,
  teamName: string,
): Omit<PlayerDetails, "source" | "competition">[] {
  const $ = parseHtml(html);
  const players: Omit<PlayerDetails, "source" | "competition">[] = [];

  // Use the first sortable table (matches R package's pluck(1))
  const table = $("table.sortable").first();
  if (table.length === 0) return players;

  const rows = table.find("tbody tr");
  // Columns (0-indexed): Cap(0), #(1), Player(2), DOB(3), HT(4), WT(5),
  //   Games(W-D-L)(6), Goals(7), Seasons(8), Debut(9), Last(10)

  rows.each((_ri, row) => {
    const cells = $(row).find("td");
    if (cells.length < 8) return;

    const jumperText = $(cells[1]).text().trim();
    const playerText = $(cells[2]).text().trim();
    if (!playerText) return;

    // Player name is "Surname, FirstName"
    const nameParts = playerText.split(",").map((s) => s.trim());
    const surname = nameParts[0] ?? "";
    const givenName = nameParts[1] ?? "";

    const dobText = $(cells[3]).text().trim();
    const htText = $(cells[4]).text().trim();
    const wtText = $(cells[5]).text().trim();
    // "Games (W-D-L)" column — extract just the leading number
    const gamesRaw = $(cells[6]).text().trim();
    const gamesMatch = /^(\d+)/.exec(gamesRaw);
    const goalsText = $(cells[7]).text().trim();
    const debutText = cells.length > 9 ? $(cells[9]).text().trim() : "";

    const heightCm = htText ? Number.parseInt(htText, 10) || null : null;
    const weightKg = wtText ? Number.parseInt(wtText, 10) || null : null;
    const gamesPlayed = gamesMatch?.[1] ? Number.parseInt(gamesMatch[1], 10) || null : null;
    const goalsScored = goalsText ? Number.parseInt(goalsText, 10) || null : null;
    const jumperNumber = jumperText ? Number.parseInt(jumperText, 10) || null : null;

    // Extract debut year from debut text (e.g. "R1 1990")
    const debutYearMatch = /(\d{4})/.exec(debutText);
    const debutYear = debutYearMatch?.[1] ? Number.parseInt(debutYearMatch[1], 10) || null : null;

    players.push({
      playerId: `AT_${teamName}_${surname}_${givenName}`.replace(/\s+/g, "_"),
      givenName,
      surname,
      displayName: givenName ? `${givenName} ${surname}` : surname,
      team: teamName,
      jumperNumber,
      position: null,
      dateOfBirth: dobText || null,
      heightCm,
      weightKg,
      gamesPlayed,
      goals: goalsScored,
      draftYear: null,
      draftPosition: null,
      draftType: null,
      debutYear,
      recruitedFrom: null,
    });
  });

  return players;
}
