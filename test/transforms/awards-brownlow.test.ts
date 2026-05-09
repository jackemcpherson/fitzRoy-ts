import { describe, expect, it } from "vitest";
import { parseBrownlowVotes } from "../../src/transforms/awards";

/**
 * Build a minimal FootyWire-shaped Brownlow HTML table with the 9-column
 * layout the parser expects: Player, Team, 3V, 2V, 1V, Players_With_Votes,
 * Games_Polled, Polled, V/G.
 */
function buildBrownlowHtml(rows: ReadonlyArray<readonly string[]>): string {
  const tr = (cells: readonly string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  const header = tr([
    "Player",
    "Team",
    "3V",
    "2V",
    "1V",
    "Players_With_Votes",
    "Games_Polled",
    "Polled",
    "V/G",
  ]);
  // Parser requires at least 5 rows total to consider a table as Brownlow
  // data (skips small stub tables). Pad with filler rows past the
  // meaningful ones so test fixtures clear that guard.
  const filler: string[] = [];
  for (let i = rows.length + 1; i < 5; i++) {
    filler.push(tr([`Filler ${i}`, "Filler", "0", "0", "0", "1", "1", "0", "0.00"]));
  }
  return `<html><body><table>${header}${rows.map(tr).join("")}${filler.join("")}</table></body></html>`;
}

describe("parseBrownlowVotes", () => {
  it("populates polledGames from the Polled column (#97)", () => {
    const html = buildBrownlowHtml([
      ["Patrick Cripps", "Carlton", "15", "0", "0", "1", "23", "17", "1.96"],
    ]);
    const result = parseBrownlowVotes(html, 2024);
    const cripps = result.find((r) => r.player === "Patrick Cripps");
    expect(cripps).toBeDefined();
    expect(cripps?.polledGames).toBe(17);
    expect(cripps?.gamesPolled).toBe(23);
  });

  it("derives isMedallist from highest votes when no row carries the W suffix", () => {
    // Reflects actual 2024 Brownlow: Cripps 45 (winner), Daicos 38, Butters 29.
    const html = buildBrownlowHtml([
      ["Patrick Cripps", "Carlton", "13", "3", "0", "1", "23", "17", "1.96"],
      ["Nick Daicos", "Collingwood", "10", "4", "0", "1", "23", "16", "1.65"],
      ["Zak Butters", "Port Adelaide", "8", "2", "1", "1", "22", "11", "1.32"],
    ]);
    const result = parseBrownlowVotes(html, 2024);
    const cripps = result.find((r) => r.player === "Patrick Cripps");
    expect(cripps?.votes).toBe(45);
    expect(cripps?.isMedallist).toBe(true);
    expect(result.find((r) => r.player === "Nick Daicos")?.isMedallist).toBe(false);
    expect(result.find((r) => r.player === "Zak Butters")?.isMedallist).toBe(false);
  });

  it("strips ' W' medallist suffix and sets isMedallist=true (R fitzRoy convention)", () => {
    const html = buildBrownlowHtml([
      ["Patrick Cripps W", "Carlton", "15", "0", "0", "1", "23", "17", "1.96"],
      ["Nick Daicos", "Collingwood", "10", "8", "4", "1", "23", "20", "1.65"],
    ]);
    const result = parseBrownlowVotes(html, 2024);
    const cripps = result.find((r) => r.player === "Patrick Cripps");
    expect(cripps).toBeDefined();
    expect(cripps?.isMedallist).toBe(true);
    expect(result.find((r) => r.player === "Nick Daicos")?.isMedallist).toBe(false);
  });

  it("honours ties in derived medallist detection", () => {
    const html = buildBrownlowHtml([
      ["Player A", "T1", "10", "0", "0", "1", "23", "10", "1.30"],
      ["Player B", "T2", "10", "0", "0", "1", "23", "10", "1.30"],
      ["Player C", "T3", "5", "0", "0", "1", "23", "5", "0.65"],
    ]);
    const result = parseBrownlowVotes(html, 2024);
    expect(result.find((r) => r.player === "Player A")?.isMedallist).toBe(true);
    expect(result.find((r) => r.player === "Player B")?.isMedallist).toBe(true);
    expect(result.find((r) => r.player === "Player C")?.isMedallist).toBe(false);
  });

  it("stamps the competition (defaults AFLM, accepts AFLW)", () => {
    const html = buildBrownlowHtml([
      ["A Player", "Carlton", "5", "0", "0", "1", "10", "5", "1.50"],
    ]);
    const aflmResult = parseBrownlowVotes(html, 2024).find((r) => r.player === "A Player");
    const aflwResult = parseBrownlowVotes(html, 2024, "AFLW").find((r) => r.player === "A Player");
    expect(aflmResult?.competition).toBe("AFLM");
    expect(aflwResult?.competition).toBe("AFLW");
  });
});
