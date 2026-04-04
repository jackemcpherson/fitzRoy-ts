/**
 * Pure transforms for AFL Tables game page HTML → PlayerStats[].
 *
 * AFL Tables game pages have `<table class="sortable">` with columns:
 * #, Player, KI, MK, HB, DI, GL, BH, HO, TK, RB, IF, CL, CG, FF, FA, BR, CP, UP, CM, MI, 1%, BO, GA, %P
 */

import * as cheerio from "cheerio";
import { safeInt } from "../lib/parse-utils";
import { normaliseTeamName } from "../lib/team-mapping";
import type { PlayerStats } from "../types";

/** Clean player name: "Surname, First" → { givenName, surname, displayName }. */
function parseName(raw: string): { givenName: string; surname: string; displayName: string } {
  const cleaned = raw.replace(/[↑↓]/g, "").trim();
  const parts = cleaned.split(",").map((s) => s.trim());
  const surname = parts[0] ?? "";
  const givenName = parts[1] ?? "";
  return {
    givenName,
    surname,
    displayName: givenName ? `${givenName} ${surname}` : surname,
  };
}

/**
 * Parse a single AFL Tables game page into PlayerStats objects.
 *
 * @param html - Raw HTML from an AFL Tables game page.
 * @param matchId - The match identifier.
 * @param season - Season year.
 * @param roundNumber - Round number.
 */
export function parseAflTablesGameStats(
  html: string,
  matchId: string,
  season: number,
  roundNumber: number,
): PlayerStats[] {
  const $ = cheerio.load(html);
  const stats: PlayerStats[] = [];

  $("table.sortable").each((_tableIdx, table) => {
    // Get team name from first header row
    const headerText = $(table).find("thead tr").first().text().trim();
    const teamMatch = /^(\w[\w\s]+?)\s+Match Statistics/i.exec(headerText);
    if (!teamMatch) return; // Skip non-stats tables (e.g. Player Details)

    const teamName = normaliseTeamName(teamMatch[1]?.trim() ?? "");

    $(table)
      .find("tbody tr")
      .each((_rowIdx, row) => {
        const cells = $(row)
          .find("td")
          .map((_, c) => $(c).text().trim())
          .get();

        if (cells.length < 24) return;

        // Columns: #(0), Player(1), KI(2), MK(3), HB(4), DI(5), GL(6), BH(7),
        //   HO(8), TK(9), RB(10), IF(11), CL(12), CG(13), FF(14), FA(15),
        //   BR(16), CP(17), UP(18), CM(19), MI(20), 1%(21), BO(22), GA(23), %P(24)
        const jumperStr = cells[0] ?? "";
        const jumperNumber = safeInt(jumperStr.replace(/[↑↓]/g, ""));
        const { givenName, surname, displayName } = parseName(cells[1] ?? "");

        stats.push({
          matchId: `AT_${matchId}`,
          season,
          roundNumber,
          team: teamName,
          competition: "AFLM",
          date: null,
          homeTeam: null,
          awayTeam: null,
          playerId: `AT_${displayName.replace(/\s+/g, "_")}`,
          givenName,
          surname,
          displayName,
          jumperNumber,
          kicks: safeInt(cells[2] ?? ""),
          handballs: safeInt(cells[4] ?? ""),
          disposals: safeInt(cells[5] ?? ""),
          marks: safeInt(cells[3] ?? ""),
          goals: safeInt(cells[6] ?? ""),
          behinds: safeInt(cells[7] ?? ""),
          tackles: safeInt(cells[9] ?? ""),
          hitouts: safeInt(cells[8] ?? ""),
          freesFor: safeInt(cells[14] ?? ""),
          freesAgainst: safeInt(cells[15] ?? ""),
          contestedPossessions: safeInt(cells[17] ?? ""),
          uncontestedPossessions: safeInt(cells[18] ?? ""),
          contestedMarks: safeInt(cells[19] ?? ""),
          intercepts: null,
          centreClearances: null,
          stoppageClearances: null,
          totalClearances: safeInt(cells[12] ?? ""),
          inside50s: safeInt(cells[11] ?? ""),
          rebound50s: safeInt(cells[10] ?? ""),
          clangers: safeInt(cells[13] ?? ""),
          turnovers: null,
          onePercenters: safeInt(cells[21] ?? ""),
          bounces: safeInt(cells[22] ?? ""),
          goalAssists: safeInt(cells[23] ?? ""),
          disposalEfficiency: null,
          metresGained: null,
          goalAccuracy: null,
          marksInside50: safeInt(cells[20] ?? ""),
          tacklesInside50: null,
          shotsAtGoal: null,
          scoreInvolvements: null,
          totalPossessions: null,
          timeOnGroundPercentage: safeInt(cells[24] ?? ""),
          ratingPoints: null,
          position: null,
          goalEfficiency: null,
          shotEfficiency: null,
          interchangeCounts: null,
          brownlowVotes: null,
          supercoachScore: null,
          dreamTeamPoints: null,
          effectiveDisposals: null,
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
          source: "afl-tables",
        });
      });
  });

  return stats;
}

/**
 * Extract game URLs from an AFL Tables season page.
 *
 * @param seasonHtml - HTML of the season page (e.g. afltables.com/afl/seas/2024.html).
 * @returns Array of relative game URLs like "../stats/games/2024/111620240307.html".
 */
export function extractGameUrls(seasonHtml: string): string[] {
  const $ = cheerio.load(seasonHtml);
  const urls: string[] = [];

  $("tr:nth-child(2) td:nth-child(4) a").each((_i, el) => {
    const href = $(el).attr("href");
    if (href) {
      urls.push(href.replace("..", "https://afltables.com/afl"));
    }
  });

  return urls;
}
