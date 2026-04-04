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
import { normaliseVenueName } from "../lib/venue-mapping";
import {
  mergeFootyWireStats,
  parseAdvancedStats,
  parseBasicStats,
} from "../transforms/footywire-player-stats";
import { finalsRoundNumber, inferRoundType } from "../transforms/match-results";
import type {
  Fixture,
  MatchResult,
  PlayerDetails,
  PlayerStats,
  RoundType,
  TeamStatsEntry,
} from "../types";

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
   * Fetch the HTML content of any URL using this client's fetch function.
   *
   * Public wrapper around the internal fetchHtml for use by external modules
   * (e.g. awards) that need to scrape FootyWire pages.
   */
  async fetchPage(url: string): Promise<Result<string, ScrapeError>> {
    return this.fetchHtml(url);
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

  /**
   * Fetch player statistics for a single match.
   *
   * Scrapes both the basic and advanced stats pages.
   * Available from 2010 onwards.
   *
   * @param matchId - The FootyWire match ID (numeric string).
   * @param season - The season year.
   * @param roundNumber - The round number.
   */
  async fetchMatchPlayerStats(
    matchId: string,
    season: number,
    roundNumber: number,
  ): Promise<Result<PlayerStats[], ScrapeError>> {
    const basicUrl = `${FOOTYWIRE_BASE}/ft_match_statistics?mid=${matchId}`;
    const advancedUrl = `${FOOTYWIRE_BASE}/ft_match_statistics?mid=${matchId}&advv=Y`;

    const basicResult = await this.fetchHtml(basicUrl);
    if (!basicResult.success) return basicResult;

    const advancedResult = await this.fetchHtml(advancedUrl);
    if (!advancedResult.success) return advancedResult;

    try {
      const basicTeams = parseBasicStats(basicResult.data);
      const advancedTeams = parseAdvancedStats(advancedResult.data);
      const stats = mergeFootyWireStats(basicTeams, advancedTeams, matchId, season, roundNumber);
      return ok(stats);
    } catch (cause) {
      return err(
        new ScrapeError(
          `Failed to parse match stats: ${cause instanceof Error ? cause.message : String(cause)}`,
          "footywire",
        ),
      );
    }
  }

  /**
   * Fetch match IDs from a season's match list page.
   *
   * Extracts `mid=XXXX` values from score links alongside round numbers.
   *
   * @param year - The season year.
   * @returns Array of match ID + round number pairs.
   */
  async fetchSeasonMatchIds(
    year: number,
  ): Promise<Result<Array<{ matchId: string; roundNumber: number }>, ScrapeError>> {
    const url = `${FOOTYWIRE_BASE}/ft_match_list?year=${year}`;
    const htmlResult = await this.fetchHtml(url);
    if (!htmlResult.success) return htmlResult;

    try {
      const $ = cheerio.load(htmlResult.data);
      const entries: Array<{ matchId: string; roundNumber: number }> = [];
      let currentRound = 0;
      let lastHARound = 0;

      $("tr").each((_i, row) => {
        const roundHeader = $(row).find("td[colspan='7']");
        if (roundHeader.length > 0) {
          const text = roundHeader.text().trim();
          const roundMatch = /Round\s+(\d+)/i.exec(text);
          if (roundMatch?.[1]) {
            currentRound = Number.parseInt(roundMatch[1], 10);
            if (inferRoundType(text) === "HomeAndAway") {
              lastHARound = currentRound;
            }
          } else if (inferRoundType(text) === "Finals") {
            currentRound = finalsRoundNumber(text, lastHARound);
          }
          return;
        }

        const scoreLink = $(row).find(".data:nth-child(5) a");
        if (scoreLink.length === 0) return;

        const href = scoreLink.attr("href") ?? "";
        const midMatch = /mid=(\d+)/.exec(href);
        if (midMatch?.[1]) {
          entries.push({ matchId: midMatch[1], roundNumber: currentRound });
        }
      });

      return ok(entries);
    } catch (cause) {
      return err(
        new ScrapeError(
          `Failed to parse match IDs: ${cause instanceof Error ? cause.message : String(cause)}`,
          "footywire",
        ),
      );
    }
  }

  /**
   * Fetch player list (team history) from FootyWire.
   *
   * Scrapes the team history page (e.g. `th-hawthorn-hawks`) which lists
   * all players who have played for that team.
   *
   * @param teamName - Canonical team name (e.g. "Hawthorn").
   * @returns Array of player details (without source/competition fields).
   */
  async fetchPlayerList(
    teamName: string,
  ): Promise<Result<Omit<PlayerDetails, "source" | "competition">[], ScrapeError>> {
    const slug = teamNameToFootyWireSlug(teamName);
    if (!slug) {
      return err(new ScrapeError(`No FootyWire slug mapping for team: ${teamName}`, "footywire"));
    }

    const url = `${FOOTYWIRE_BASE}/tp-${slug}`;
    const htmlResult = await this.fetchHtml(url);
    if (!htmlResult.success) return htmlResult;

    try {
      const players = parseFootyWirePlayerList(htmlResult.data, teamName);
      return ok(players);
    } catch (cause) {
      return err(
        new ScrapeError(
          `Failed to parse player list: ${cause instanceof Error ? cause.message : String(cause)}`,
          "footywire",
        ),
      );
    }
  }

  /**
   * Fetch fixture data from FootyWire.
   *
   * Parses the match list page to extract scheduled matches with dates and venues.
   *
   * @param year - The season year.
   * @returns Array of fixture entries.
   */
  async fetchSeasonFixture(year: number): Promise<Result<Fixture[], ScrapeError>> {
    const url = `${FOOTYWIRE_BASE}/ft_match_list?year=${year}`;
    const htmlResult = await this.fetchHtml(url);
    if (!htmlResult.success) return htmlResult;

    try {
      const fixtures = parseFixtureList(htmlResult.data, year);
      return ok(fixtures);
    } catch (cause) {
      return err(
        new ScrapeError(
          `Failed to parse fixture list: ${cause instanceof Error ? cause.message : String(cause)}`,
          "footywire",
        ),
      );
    }
  }

  /**
   * Fetch team statistics from FootyWire.
   *
   * Scrapes team-level aggregate stats (totals or averages) for a season.
   *
   * @param year - The season year.
   * @param summaryType - "totals" or "averages" (default "totals").
   * @returns Array of team stats entries.
   */
  async fetchTeamStats(
    year: number,
    summaryType: "totals" | "averages" = "totals",
  ): Promise<Result<TeamStatsEntry[], ScrapeError>> {
    const teamType = summaryType === "averages" ? "TA" : "TT";
    const oppType = summaryType === "averages" ? "OA" : "OT";
    const teamUrl = `${FOOTYWIRE_BASE}/ft_team_rankings?year=${year}&type=${teamType}&sby=2`;
    const oppUrl = `${FOOTYWIRE_BASE}/ft_team_rankings?year=${year}&type=${oppType}&sby=2`;

    const [teamResult, oppResult] = await Promise.all([
      this.fetchHtml(teamUrl),
      this.fetchHtml(oppUrl),
    ]);

    if (!teamResult.success) return teamResult;
    if (!oppResult.success) return oppResult;

    try {
      const teamStats = parseFootyWireTeamStats(teamResult.data, year, "for");
      const oppStats = parseFootyWireTeamStats(oppResult.data, year, "against");

      // Merge team and opposition stats by team name
      const merged = mergeTeamAndOppStats(teamStats, oppStats);
      return ok(merged);
    } catch (cause) {
      return err(
        new ScrapeError(
          `Failed to parse team stats: ${cause instanceof Error ? cause.message : String(cause)}`,
          "footywire",
        ),
      );
    }
  }
}

/**
 * Parse FootyWire match list HTML into MatchResult objects.
 *
 * @param html - Raw HTML from the FootyWire match list page.
 * @param year - The season year used for date parsing and metadata.
 * @returns Array of match results extracted from the page.
 */
export function parseMatchList(html: string, year: number): MatchResult[] {
  const $ = cheerio.load(html);
  const results: MatchResult[] = [];
  let currentRound = 0;
  let lastHARound = 0;
  let currentRoundType: RoundType = "HomeAndAway";
  let currentRoundName = "";

  // Each row is either a round header (colspan=7) or a match row
  $("tr").each((_i, row) => {
    const roundHeader = $(row).find("td[colspan='7']");
    if (roundHeader.length > 0) {
      const text = roundHeader.text().trim();
      currentRoundName = text;
      currentRoundType = inferRoundType(text);
      const roundMatch = /Round\s+(\d+)/i.exec(text);
      if (roundMatch?.[1]) {
        currentRound = Number.parseInt(roundMatch[1], 10);
        if (currentRoundType === "HomeAndAway") {
          lastHARound = currentRound;
        }
      } else if (currentRoundType === "Finals") {
        currentRound = finalsRoundNumber(text, lastHARound);
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
    const date = parseFootyWireDate(dateText, year) ?? new Date(Date.UTC(year, 0, 1));

    // Estimate goals/behinds (FootyWire only gives total score on this page)
    const homeGoals = Math.floor(homePoints / 6);
    const homeBehinds = homePoints - homeGoals * 6;
    const awayGoals = Math.floor(awayPoints / 6);
    const awayBehinds = awayPoints - awayGoals * 6;

    results.push({
      matchId,
      season: year,
      roundNumber: currentRound,
      roundType: currentRoundType,
      roundName: currentRoundName || null,
      date,
      venue: normaliseVenueName(venue),
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
      venueState: null,
      venueTimezone: null,
      homeRushedBehinds: null,
      awayRushedBehinds: null,
      homeMinutesInFront: null,
      awayMinutesInFront: null,
      source: "footywire",
      competition: "AFLM",
    });
  });

  return results;
}

/**
 * Parse FootyWire match list HTML into Fixture objects.
 *
 * Similar to parseMatchList but returns Fixture type (no scores required).
 * Includes both played and upcoming matches.
 */
export function parseFixtureList(html: string, year: number): Fixture[] {
  const $ = cheerio.load(html);
  const fixtures: Fixture[] = [];
  let currentRound = 0;
  let lastHARound = 0;
  let currentRoundType: RoundType = "HomeAndAway";
  let gameNumber = 0;

  $("tr").each((_i, row) => {
    const roundHeader = $(row).find("td[colspan='7']");
    if (roundHeader.length > 0) {
      const text = roundHeader.text().trim();
      currentRoundType = inferRoundType(text);
      const roundMatch = /Round\s+(\d+)/i.exec(text);
      if (roundMatch?.[1]) {
        currentRound = Number.parseInt(roundMatch[1], 10);
        if (currentRoundType === "HomeAndAway") {
          lastHARound = currentRound;
        }
      } else if (currentRoundType === "Finals") {
        currentRound = finalsRoundNumber(text, lastHARound);
      }
      return;
    }

    const cells = $(row).find("td.data");
    if (cells.length < 3) return;

    const dateText = $(cells[0]).text().trim();
    const teamsCell = $(cells[1]);
    const venue = $(cells[2]).text().trim();

    if (venue === "BYE") return;

    const teamLinks = teamsCell.find("a");
    if (teamLinks.length < 2) return;
    const homeTeam = normaliseTeamName($(teamLinks[0]).text().trim());
    const awayTeam = normaliseTeamName($(teamLinks[1]).text().trim());

    const date = parseFootyWireDate(dateText, year) ?? new Date(Date.UTC(year, 0, 1));
    gameNumber++;

    // Check if we have a score (match played) or not (upcoming)
    const scoreCell = cells.length >= 5 ? $(cells[4]) : null;
    const scoreText = scoreCell?.text().trim() ?? "";
    const hasScore = /\d+-\d+/.test(scoreText);

    fixtures.push({
      matchId: `FW_${year}_R${currentRound}_G${gameNumber}`,
      season: year,
      roundNumber: currentRound,
      roundType: currentRoundType,
      date,
      venue: normaliseVenueName(venue),
      homeTeam,
      awayTeam,
      status: hasScore ? "Complete" : "Upcoming",
      competition: "AFLM",
    });
  });

  return fixtures;
}

/**
 * Parse FootyWire team statistics HTML into TeamStatsEntry objects.
 *
 * The R package uses `tables[[11]]` (the 11th table on the page) with
 * hardcoded column positions. Team name is in an `<a>` inside column 2.
 *
 * Columns (1-indexed): Rk(1), Team(2), Gm(3), K(4), HB(5), D(6), M(7),
 *   G(8), GA(9), I50(10), BH(11), T(12), HO(13), FF(14), FA(15),
 *   CL(16), CG(17), R50(18), AF(19), SC(20)
 *
 * @param html - Raw HTML from the FootyWire team rankings page.
 * @param year - The season year.
 * @param suffix - "for" or "against" to prefix stat keys.
 * @returns Array of team stats entries.
 */
export function parseFootyWireTeamStats(
  html: string,
  year: number,
  suffix: "for" | "against",
): TeamStatsEntry[] {
  const $ = cheerio.load(html);
  const entries: TeamStatsEntry[] = [];

  const tables = $("table");
  // The R package uses tables[[11]] (1-indexed) → index 10 in 0-indexed
  // Fallback: look for table with class "sortable" or one containing team data
  const mainTable = tables.length > 10 ? $(tables[10]) : $("table.sortable").first();
  if (mainTable.length === 0) return entries;

  const STAT_KEYS = [
    "K",
    "HB",
    "D",
    "M",
    "G",
    "GA",
    "I50",
    "BH",
    "T",
    "HO",
    "FF",
    "FA",
    "CL",
    "CG",
    "R50",
    "AF",
    "SC",
  ];

  const rows = mainTable.find("tr");
  rows.each((rowIdx, row) => {
    if (rowIdx === 0) return; // skip header

    const cells = $(row).find("td");
    if (cells.length < 20) return;

    // Column 2 (0-indexed: 1) has team name inside an <a> tag
    const teamLink = $(cells[1]).find("a");
    const teamText = teamLink.length > 0 ? teamLink.text().trim() : $(cells[1]).text().trim();
    const teamName = normaliseTeamName(teamText);
    if (!teamName) return;

    const parseNum = (cell: ReturnType<typeof $>) => Number.parseFloat(cell.text().trim()) || 0;

    const gamesPlayed = parseNum($(cells[2]));
    const stats: Record<string, number> = {};

    // Columns 3-19 (0-indexed) map to STAT_KEYS
    for (let i = 0; i < STAT_KEYS.length; i++) {
      const key = suffix === "against" ? `${STAT_KEYS[i]}_against` : (STAT_KEYS[i] as string);
      stats[key] = parseNum($(cells[i + 3]));
    }

    entries.push({
      season: year,
      team: teamName,
      gamesPlayed,
      stats,
      source: "footywire",
    });
  });

  return entries;
}

/**
 * Merge team "for" stats and "against" stats into a single entry per team.
 */
function mergeTeamAndOppStats(
  teamStats: TeamStatsEntry[],
  oppStats: TeamStatsEntry[],
): TeamStatsEntry[] {
  const oppMap = new Map<string, Readonly<Record<string, number>>>();
  for (const entry of oppStats) {
    oppMap.set(entry.team, entry.stats);
  }

  return teamStats.map((entry) => {
    const opp = oppMap.get(entry.team);
    if (!opp) return entry;
    return {
      ...entry,
      stats: { ...entry.stats, ...opp },
    };
  });
}

// ---------------------------------------------------------------------------
// FootyWire team slug mapping
// ---------------------------------------------------------------------------

/** Map canonical team names to FootyWire URL slugs (used in `th-SLUG` pages). */
const FOOTYWIRE_SLUG_MAP: ReadonlyMap<string, string> = new Map([
  ["Adelaide Crows", "adelaide-crows"],
  ["Brisbane Lions", "brisbane-lions"],
  ["Carlton", "carlton-blues"],
  ["Collingwood", "collingwood-magpies"],
  ["Essendon", "essendon-bombers"],
  ["Fremantle", "fremantle-dockers"],
  ["Geelong Cats", "geelong-cats"],
  ["Gold Coast Suns", "gold-coast-suns"],
  ["GWS Giants", "greater-western-sydney-giants"],
  ["Hawthorn", "hawthorn-hawks"],
  ["Melbourne", "melbourne-demons"],
  ["North Melbourne", "north-melbourne-kangaroos"],
  ["Port Adelaide", "port-adelaide-power"],
  ["Richmond", "richmond-tigers"],
  ["St Kilda", "st-kilda-saints"],
  ["Sydney Swans", "sydney-swans"],
  ["West Coast Eagles", "west-coast-eagles"],
  ["Western Bulldogs", "western-bulldogs"],
]);

/**
 * Convert a canonical team name to a FootyWire URL slug.
 *
 * @param teamName - Canonical team name (e.g. "Hawthorn").
 * @returns The FootyWire slug or undefined if not found.
 */
function teamNameToFootyWireSlug(teamName: string): string | undefined {
  return FOOTYWIRE_SLUG_MAP.get(teamName);
}

/** Normalise a raw DOB string (e.g. "7 Oct 1995") to ISO format ("1995-10-07"). */
function normaliseDob(raw: string): string | null {
  if (!raw) return null;
  const parsed = parseFootyWireDate(raw);
  if (parsed) return parsed.toISOString().slice(0, 10);
  return raw; // Return raw string as fallback if parsing fails
}

/**
 * Parse FootyWire team history HTML into player detail objects.
 *
 * The team history page (`th-TEAM`) has a table with columns:
 * No, Surname, First Name, Games, Age, DOB, Height, Origin, Pos1, Pos2
 *
 * @param html - Raw HTML from the FootyWire team history page.
 * @param teamName - Canonical team name.
 * @returns Array of player details.
 */
function parseFootyWirePlayerList(
  html: string,
  teamName: string,
): Omit<PlayerDetails, "source" | "competition">[] {
  const $ = cheerio.load(html);
  const players: Omit<PlayerDetails, "source" | "competition">[] = [];

  // The R package finds the table whose first row contains "Age".
  // Columns: No(0), Name(1), Games(2), Age(3), Date of Birth(4), Height(5), Origin(6), Position(7)
  // Name is "Surname, FirstName" format.
  let dataRows: ReturnType<typeof $> | null = null;

  $("table").each((_i, table) => {
    const firstRow = $(table).find("tr").first();
    const cells = firstRow.find("td, th");
    // Match the R package: look for a row with an "Age" cell specifically
    const cellTexts = cells.map((_j, c) => $(c).text().trim()).get();
    if (cellTexts.includes("Age") && cellTexts.includes("Name")) {
      dataRows = $(table).find("tr");
      return false; // break
    }
  });

  if (!dataRows) return players;

  (dataRows as ReturnType<typeof $>).each((_rowIdx, row) => {
    const cells = $(row).find("td");
    if (cells.length < 6) return;

    const jumperText = $(cells[0]).text().trim();
    const nameText = $(cells[1]).text().trim();
    const gamesText = $(cells[2]).text().trim();
    const dobText = cells.length > 4 ? $(cells[4]).text().trim() : "";
    const heightText = cells.length > 5 ? $(cells[5]).text().trim() : "";
    const origin = cells.length > 6 ? $(cells[6]).text().trim() : "";
    const position = cells.length > 7 ? $(cells[7]).text().trim() : "";

    // Name is "Surname, FirstName" — split and handle "\nR" suffix (R package strips this)
    const cleanedName = nameText.replace(/\nR$/, "").trim();
    if (!cleanedName || cleanedName === "Name") return;

    const nameParts = cleanedName.split(",").map((s) => s.trim());
    const surname = nameParts[0] ?? "";
    const givenName = nameParts[1] ?? "";

    const jumperNumber = jumperText ? Number.parseInt(jumperText, 10) || null : null;
    const gamesPlayed = gamesText ? Number.parseInt(gamesText, 10) || null : null;
    const heightMatch = /(\d+)cm/.exec(heightText);
    const heightCm = heightMatch?.[1] ? Number.parseInt(heightMatch[1], 10) || null : null;

    players.push({
      playerId: `FW_${teamName}_${surname}_${givenName}`.replace(/\s+/g, "_"),
      givenName,
      surname,
      displayName: givenName ? `${givenName} ${surname}` : surname,
      team: teamName,
      jumperNumber,
      position: position || null,
      dateOfBirth: normaliseDob(dobText),
      heightCm,
      weightKg: null,
      gamesPlayed,
      goals: null,
      draftYear: null,
      draftPosition: null,
      draftType: null,
      debutYear: null,
      recruitedFrom: origin || null,
    });
  });

  return players;
}
