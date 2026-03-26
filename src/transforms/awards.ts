/**
 * Pure transforms for FootyWire awards pages → Award types.
 */

import * as cheerio from "cheerio";
import { safeInt } from "../lib/parse-utils";
import type { AllAustralianSelection, BrownlowVote, RisingStarNomination } from "../types";

/**
 * Parse Brownlow Medal player votes from FootyWire HTML.
 *
 * The page has a table with 9 columns:
 * Player, Team, 3V, 2V, 1V, Players_With_Votes, Games_Polled, Polled, V/G
 */
export function parseBrownlowVotes(html: string, season: number): BrownlowVote[] {
  const $ = cheerio.load(html);
  const results: BrownlowVote[] = [];

  $("table").each((_i, table) => {
    const rows = $(table).find("tr");
    if (rows.length < 5) return;

    // Look for a table with 9 columns (player Brownlow format)
    const firstDataRow = $(rows[1]);
    const cells = firstDataRow.find("td");
    if (cells.length !== 9) return;

    // Check if first cell looks like a player name (skip header-like rows)
    const headerRow = $(rows[0]);
    const headerCells = headerRow.find("td, th");
    const firstHeader = headerCells.first().text().trim().toLowerCase();
    const startIdx = firstHeader === "player" || firstHeader === "" ? 1 : 0;

    rows.each((j, row) => {
      if (j < startIdx) return;
      const tds = $(row).find("td");
      if (tds.length < 9) return;

      const player = $(tds[0]).text().trim();
      const team = $(tds[1]).text().trim();

      if (!player || player.toLowerCase() === "player") return;

      const votes3 = safeInt($(tds[2]).text()) ?? 0;
      const votes2 = safeInt($(tds[3]).text()) ?? 0;
      const votes1 = safeInt($(tds[4]).text()) ?? 0;
      const gamesPolled = safeInt($(tds[6]).text());

      results.push({
        type: "brownlow",
        season,
        player,
        team,
        votes: votes3 * 3 + votes2 * 2 + votes1,
        votes3,
        votes2,
        votes1,
        gamesPolled,
      });
    });
  });

  return results;
}

/**
 * Parse All-Australian team selections from FootyWire HTML.
 *
 * The page uses specific row indices for the final 22 team layout.
 */
export function parseAllAustralian(html: string, season: number): AllAustralianSelection[] {
  const $ = cheerio.load(html);
  const results: AllAustralianSelection[] = [];

  const rows = $("tr");

  // Look for rows that have position labels and player links with team flags
  rows.each((_i, row) => {
    const tds = $(row).find("td");
    if (tds.length < 2) return;

    const position = $(tds[0]).text().trim();
    if (!position) return;

    // Known AA positions
    const validPositions = ["FB", "HB", "C", "HF", "FF", "FOL", "IC", "EMG"];
    if (!validPositions.includes(position)) return;

    // Each remaining cell may contain a player
    tds.each((cellIdx, cell) => {
      if (cellIdx === 0) return; // skip position cell

      const playerLink = $(cell).find("a");
      const playerName = playerLink.text().trim();
      const teamSpan = $(cell).find("span.playerflag");
      const team = teamSpan.text().trim();

      if (playerName && team) {
        results.push({
          type: "all-australian",
          season,
          position,
          player: playerName,
          team,
        });
      }
    });
  });

  return results;
}

/**
 * Parse Rising Star nominations from FootyWire HTML.
 *
 * Uses table index 11 (0-based: 10) which has the nomination data.
 */
export function parseRisingStarNominations(html: string, season: number): RisingStarNomination[] {
  const $ = cheerio.load(html);
  const results: RisingStarNomination[] = [];

  const tables = $("table");
  let targetRows: ReturnType<typeof $> | null = null;

  tables.each((_i, table) => {
    const rows = $(table).find("tr");
    if (rows.length < 5) return;

    const firstRow = $(rows[0]);
    const headerCells = firstRow
      .find("td, th")
      .map((_, c) => $(c).text().trim())
      .get();

    if (
      headerCells.length >= 15 &&
      (headerCells[0]?.toLowerCase().includes("round") ||
        headerCells[0]?.toLowerCase().includes("rnd"))
    ) {
      targetRows = rows;
      return false; // break
    }
  });

  if (!targetRows) return results;

  (targetRows as ReturnType<typeof $>).each((_j, row) => {
    if (_j === 0) return; // skip header

    const tds = $(row).find("td");
    if (tds.length < 15) return;

    const roundText = $(tds[0]).text().trim();
    const round = safeInt(roundText);
    if (round == null) return;

    const player = $(tds[1]).text().trim();
    const team = $(tds[2]).text().trim();
    const opponent = $(tds[3]).text().trim();

    if (!player || player.toLowerCase() === "name") return;

    results.push({
      type: "rising-star",
      season,
      round,
      player,
      team,
      opponent,
      kicks: safeInt($(tds[4]).text()),
      handballs: safeInt($(tds[5]).text()),
      disposals: safeInt($(tds[6]).text()),
      marks: safeInt($(tds[7]).text()),
      goals: safeInt($(tds[8]).text()),
      behinds: safeInt($(tds[9]).text()),
      tackles: safeInt($(tds[10]).text()),
    });
  });

  return results;
}
