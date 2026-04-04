/**
 * Pure transforms for FootyWire match statistics HTML → PlayerStats[].
 *
 * FootyWire provides two pages per match:
 * - Basic: K, HB, D, M, G, B, T, HO, GA, I50, CL, CG, R50, FF, FA, AF, SC
 * - Advanced: CP, UP, ED, DE%, CM, GA, MI5, 1%, BO, CCL, SCL, SI, MG, TO, ITC, T5, TOG%
 */

import * as cheerio from "cheerio";
import { parseFloatOr0, parseIntOr0 } from "../lib/parse-utils";
import { normaliseTeamName } from "../lib/team-mapping";
import { normaliseVenueName } from "../lib/venue-mapping";
import type { PlayerStats } from "../types";

/** Column indices for the basic stats table header. */
const BASIC_COLS = [
  "Player",
  "K",
  "HB",
  "D",
  "M",
  "G",
  "B",
  "T",
  "HO",
  "GA",
  "I50",
  "CL",
  "CG",
  "R50",
  "FF",
  "FA",
  "AF",
  "SC",
] as const;

/** Column indices for the advanced stats table header. */
const ADVANCED_COLS = [
  "Player",
  "CP",
  "UP",
  "ED",
  "DE",
  "CM",
  "GA",
  "MI5",
  "1%",
  "BO",
  "CCL",
  "SCL",
  "SI",
  "MG",
  "TO",
  "ITC",
  "T5",
  "TOG",
] as const;

interface RawBasicRow {
  readonly player: string;
  readonly kicks: number;
  readonly handballs: number;
  readonly disposals: number;
  readonly marks: number;
  readonly goals: number;
  readonly behinds: number;
  readonly tackles: number;
  readonly hitouts: number;
  readonly goalAssists: number;
  readonly inside50s: number;
  readonly clearances: number;
  readonly clangers: number;
  readonly rebound50s: number;
  readonly freesFor: number;
  readonly freesAgainst: number;
  readonly dreamTeamPoints: number;
  readonly supercoachPoints: number;
}

interface RawAdvancedRow {
  readonly player: string;
  readonly contestedPossessions: number;
  readonly uncontestedPossessions: number;
  readonly effectiveDisposals: number;
  readonly disposalEfficiency: number;
  readonly contestedMarks: number;
  readonly goalAssists: number;
  readonly marksInside50: number;
  readonly onePercenters: number;
  readonly bounces: number;
  readonly centreClearances: number;
  readonly stoppageClearances: number;
  readonly scoreInvolvements: number;
  readonly metresGained: number;
  readonly turnovers: number;
  readonly intercepts: number;
  readonly tacklesInside50: number;
  readonly timeOnGroundPercentage: number;
}

/** Match details extracted from the page metadata. */
interface MatchDetails {
  readonly round: string;
  readonly venue: string;
  readonly dateStr: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
}

/** Clean player name (remove sub arrows and whitespace). */
function cleanPlayerName(raw: string): string {
  return raw.replace(/[↗↙]/g, "").trim();
}

/**
 * Parse the stats tables from a FootyWire match statistics page.
 *
 * The page has two team stats tables. Each is a `<table>` with a header row
 * (Player, K, HB, ...) followed by player rows.
 *
 * @returns Array of [teamName, rows] tuples — one per team.
 */
function parseStatsTable<T>(
  html: string,
  expectedCols: readonly string[],
  rowParser: (cells: string[]) => T | null,
): [string, T[]][] {
  const $ = cheerio.load(html);
  const results: [string, T[]][] = [];

  $("table").each((_i, table) => {
    const rows = $(table).find("tr");
    if (rows.length < 3) return;

    // Check if header row matches expected columns
    const headerCells = $(rows[0])
      .find("td, th")
      .map((_, c) => $(c).text().trim())
      .get();

    // Header should start with "Player" and have our expected stat columns
    if (headerCells[0] !== "Player" || headerCells.length < expectedCols.length) return;
    // Verify at least some key column names match
    if (!headerCells.includes(expectedCols[1] as string)) return;

    // Extract team name from parent container
    let teamName = "";
    const parentTable = $(table).closest("table").parent().closest("table");
    const teamHeader = parentTable.find("td:contains('Match Statistics')").first();
    if (teamHeader.length > 0) {
      const headerText = teamHeader.text().trim();
      const match = /^(\w[\w\s]+?)\s+Match Statistics/i.exec(headerText);
      if (match?.[1]) {
        teamName = normaliseTeamName(match[1].trim());
      }
    }

    const parsed: T[] = [];
    rows.each((j, row) => {
      if (j === 0) return; // skip header
      const cells = $(row)
        .find("td")
        .map((_, c) => $(c).text().trim())
        .get();
      if (cells.length < expectedCols.length - 1) return;
      const result = rowParser(cells);
      if (result) parsed.push(result);
    });

    if (parsed.length > 0) {
      results.push([teamName, parsed]);
    }
  });

  return results;
}

/** Parse basic stats rows. */
function parseBasicRow(cells: string[]): RawBasicRow | null {
  const player = cleanPlayerName(cells[0] ?? "");
  if (!player) return null;

  return {
    player,
    kicks: parseIntOr0(cells[1] ?? "0"),
    handballs: parseIntOr0(cells[2] ?? "0"),
    disposals: parseIntOr0(cells[3] ?? "0"),
    marks: parseIntOr0(cells[4] ?? "0"),
    goals: parseIntOr0(cells[5] ?? "0"),
    behinds: parseIntOr0(cells[6] ?? "0"),
    tackles: parseIntOr0(cells[7] ?? "0"),
    hitouts: parseIntOr0(cells[8] ?? "0"),
    goalAssists: parseIntOr0(cells[9] ?? "0"),
    inside50s: parseIntOr0(cells[10] ?? "0"),
    clearances: parseIntOr0(cells[11] ?? "0"),
    clangers: parseIntOr0(cells[12] ?? "0"),
    rebound50s: parseIntOr0(cells[13] ?? "0"),
    freesFor: parseIntOr0(cells[14] ?? "0"),
    freesAgainst: parseIntOr0(cells[15] ?? "0"),
    dreamTeamPoints: parseIntOr0(cells[16] ?? "0"),
    supercoachPoints: parseIntOr0(cells[17] ?? "0"),
  };
}

/** Parse advanced stats rows. */
function parseAdvancedRow(cells: string[]): RawAdvancedRow | null {
  const player = cleanPlayerName(cells[0] ?? "");
  if (!player) return null;

  return {
    player,
    contestedPossessions: parseIntOr0(cells[1] ?? "0"),
    uncontestedPossessions: parseIntOr0(cells[2] ?? "0"),
    effectiveDisposals: parseIntOr0(cells[3] ?? "0"),
    disposalEfficiency: parseFloatOr0(cells[4] ?? "0"),
    contestedMarks: parseIntOr0(cells[5] ?? "0"),
    goalAssists: parseIntOr0(cells[6] ?? "0"),
    marksInside50: parseIntOr0(cells[7] ?? "0"),
    onePercenters: parseIntOr0(cells[8] ?? "0"),
    bounces: parseIntOr0(cells[9] ?? "0"),
    centreClearances: parseIntOr0(cells[10] ?? "0"),
    stoppageClearances: parseIntOr0(cells[11] ?? "0"),
    scoreInvolvements: parseIntOr0(cells[12] ?? "0"),
    metresGained: parseIntOr0(cells[13] ?? "0"),
    turnovers: parseIntOr0(cells[14] ?? "0"),
    intercepts: parseIntOr0(cells[15] ?? "0"),
    tacklesInside50: parseIntOr0(cells[16] ?? "0"),
    timeOnGroundPercentage: parseFloatOr0(cells[17] ?? "0"),
  };
}

/** Extract match details from the page. */
export function extractMatchDetails(html: string): MatchDetails {
  const $ = cheerio.load(html);

  const lnorms = $(".lnorm")
    .map((_, el) => $(el).text().trim())
    .get();

  // lnorm[0]: "Round 0, SCG, Attendance: 40012"
  // lnorm[1]: "Thursday, 7th March 2024, 7:30 PM AEDT"
  const detailLine = lnorms[0] ?? "";
  const dateLine = lnorms[1] ?? "";

  const parts = detailLine.split(",").map((s) => s.trim());
  const round = parts[0] ?? "";
  const venue = normaliseVenueName(parts[1] ?? "");

  // Extract teams from the score table
  const scoreTable = $("#matchscoretable");
  const teamRows = scoreTable.find("tr").slice(1); // skip header
  const homeTeam = normaliseTeamName($(teamRows[0]).find("td").first().text().trim());
  const awayTeam = normaliseTeamName($(teamRows[1]).find("td").first().text().trim());

  return {
    round,
    venue,
    dateStr: dateLine,
    homeTeam,
    awayTeam,
  };
}

/**
 * Parse basic stats from FootyWire match statistics HTML.
 *
 * @returns Array of [teamName, rows] tuples.
 */
export function parseBasicStats(html: string): [string, RawBasicRow[]][] {
  return parseStatsTable(html, [...BASIC_COLS], parseBasicRow);
}

/**
 * Parse advanced stats from FootyWire match statistics HTML.
 *
 * @returns Array of [teamName, rows] tuples.
 */
export function parseAdvancedStats(html: string): [string, RawAdvancedRow[]][] {
  return parseStatsTable(html, [...ADVANCED_COLS], parseAdvancedRow);
}

/**
 * Merge basic and advanced stats into PlayerStats objects.
 */
export function mergeFootyWireStats(
  basicTeams: [string, RawBasicRow[]][],
  advancedTeams: [string, RawAdvancedRow[]][],
  matchId: string,
  season: number,
  roundNumber: number,
): PlayerStats[] {
  const stats: PlayerStats[] = [];

  for (let teamIdx = 0; teamIdx < basicTeams.length; teamIdx++) {
    const basicEntry = basicTeams[teamIdx];
    const advancedEntry = advancedTeams[teamIdx];
    if (!basicEntry) continue;

    const [teamName, basicRows] = basicEntry;
    const advancedRows = advancedEntry?.[1] ?? [];

    // Build lookup from abbreviated name to advanced row
    const advancedByName = new Map<string, RawAdvancedRow>();
    for (const adv of advancedRows) {
      advancedByName.set(adv.player.toLowerCase(), adv);
    }

    for (const basic of basicRows) {
      // Match advanced row by abbreviated name
      // Advanced uses "I Heeney" format, basic uses "Isaac Heeney"
      // Try matching by surname (last word)
      const nameParts = basic.player.split(/\s+/);
      const surname = nameParts[nameParts.length - 1] ?? "";
      const firstName = nameParts.slice(0, -1).join(" ");
      const initial = firstName.charAt(0);
      const abbrevName = `${initial} ${surname}`.toLowerCase();

      const adv = advancedByName.get(abbrevName);

      stats.push({
        matchId: `FW_${matchId}`,
        season,
        roundNumber,
        team: teamName,
        competition: "AFLM",
        date: null,
        homeTeam: null,
        awayTeam: null,
        playerId: `FW_${basic.player.replace(/\s+/g, "_")}`,
        givenName: firstName,
        surname,
        displayName: basic.player,
        jumperNumber: null,
        kicks: basic.kicks,
        handballs: basic.handballs,
        disposals: basic.disposals,
        marks: basic.marks,
        goals: basic.goals,
        behinds: basic.behinds,
        tackles: basic.tackles,
        hitouts: basic.hitouts,
        freesFor: basic.freesFor,
        freesAgainst: basic.freesAgainst,
        contestedPossessions: adv?.contestedPossessions ?? null,
        uncontestedPossessions: adv?.uncontestedPossessions ?? null,
        contestedMarks: adv?.contestedMarks ?? null,
        intercepts: adv?.intercepts ?? null,
        centreClearances: adv?.centreClearances ?? null,
        stoppageClearances: adv?.stoppageClearances ?? null,
        totalClearances: basic.clearances,
        inside50s: basic.inside50s,
        rebound50s: basic.rebound50s,
        clangers: basic.clangers,
        turnovers: adv?.turnovers ?? null,
        onePercenters: adv?.onePercenters ?? null,
        bounces: adv?.bounces ?? null,
        goalAssists: basic.goalAssists,
        disposalEfficiency: adv?.disposalEfficiency ?? null,
        metresGained: adv?.metresGained ?? null,
        goalAccuracy: null,
        marksInside50: adv?.marksInside50 ?? null,
        tacklesInside50: adv?.tacklesInside50 ?? null,
        shotsAtGoal: null,
        scoreInvolvements: adv?.scoreInvolvements ?? null,
        totalPossessions: null,
        timeOnGroundPercentage: adv?.timeOnGroundPercentage ?? null,
        ratingPoints: null,
        position: null,
        goalEfficiency: null,
        shotEfficiency: null,
        interchangeCounts: null,
        brownlowVotes: null,
        supercoachScore: basic.supercoachPoints,
        dreamTeamPoints: basic.dreamTeamPoints,
        effectiveDisposals: adv?.effectiveDisposals ?? null,
        effectiveKicks: null,
        kickEfficiency: null,
        kickToHandballRatio: null,
        pressureActs: null,
        defHalfPressureActs: null,
        spoils: null,
        hitoutsToAdvantage: null,
        hitoutWinPercentage: null,
        hitoutToAdvantageRate: null,
        groundBallGets: null,
        f50GroundBallGets: null,
        interceptMarks: null,
        marksOnLead: null,
        contestedPossessionRate: null,
        contestOffOneOnOnes: null,
        contestOffWins: null,
        contestOffWinsPercentage: null,
        contestDefOneOnOnes: null,
        contestDefLosses: null,
        contestDefLossPercentage: null,
        centreBounceAttendances: null,
        kickins: null,
        kickinsPlayon: null,
        ruckContests: null,
        scoreLaunches: null,
        source: "footywire",
      });
    }
  }

  return stats;
}
