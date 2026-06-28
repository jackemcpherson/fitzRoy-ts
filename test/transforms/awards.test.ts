import { describe, expect, it } from "vitest";
import { parseAllAustralian, parseRisingStarNominations } from "../../src/transforms/awards";

/**
 * Render a `<tr>` from raw cell HTML fragments. Mirrors the inline-HTML
 * builder convention in `awards-brownlow.test.ts` but lets each cell carry
 * arbitrary markup (anchors, team-flag spans) rather than plain text.
 */
function tr(cells: readonly string[]): string {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
}

/**
 * Build an All-Australian player cell: an `<a>` carrying the name and a
 * `span.playerflag` carrying the team — the two selectors `parseAllAustralian`
 * reads. Either part can be omitted to exercise the "skip" branches.
 */
function aaCell(player: string | null, team: string | null): string {
  const link = player == null ? "" : `<a>${player}</a>`;
  const flag = team == null ? "" : `<span class="playerflag">${team}</span>`;
  return `${link}${flag}`;
}

describe("parseAllAustralian", () => {
  it("parses a valid position row into selections with normalised teams", () => {
    // "Blues" → "Carlton", "Magpies" → "Collingwood" via normaliseTeamName.
    const html = `<html><body><table>${tr([
      "FB",
      aaCell("Player One", "Blues"),
      aaCell("Player Two", "Magpies"),
    ])}</table></body></html>`;

    const result = parseAllAustralian(html, 2024);

    expect(result).toHaveLength(2);
    const one = result.find((r) => r.player === "Player One");
    expect(one).toMatchObject({
      type: "all-australian",
      season: 2024,
      source: "footywire",
      position: "FB",
      player: "Player One",
      team: "Carlton",
    });
    expect(result.find((r) => r.player === "Player Two")?.team).toBe("Collingwood");
  });

  it("ignores rows whose first cell is not a valid position label", () => {
    const html = `<html><body><table>${tr([
      "XX",
      aaCell("Ghost Player", "Blues"),
    ])}</table></body></html>`;

    expect(parseAllAustralian(html, 2024)).toEqual([]);
  });

  it("skips a player cell that has a name but no team flag", () => {
    const html = `<html><body><table>${tr([
      "HF",
      aaCell("Has Team", "Power"),
      aaCell("No Flag", null),
    ])}</table></body></html>`;

    const result = parseAllAustralian(html, 2024);

    expect(result).toHaveLength(1);
    expect(result[0]?.player).toBe("Has Team");
    expect(result[0]?.team).toBe("Port Adelaide");
  });

  it("defaults the competition to AFLM and stamps AFLW when requested", () => {
    const html = `<html><body><table>${tr([
      "C",
      aaCell("Mid Fielder", "Blues"),
    ])}</table></body></html>`;

    expect(parseAllAustralian(html, 2024)[0]?.competition).toBe("AFLM");
    expect(parseAllAustralian(html, 2024, "AFLW")[0]?.competition).toBe("AFLW");
  });
});

/**
 * Build a Rising Star table. The parser requires a header whose first cell is
 * a round label and at least 15 header cells, plus data rows with ≥15 `<td>`s.
 * Columns 0-10 carry: round, player, team, opponent, kicks, handballs,
 * disposals, marks, goals, behinds, tackles. Remaining cells pad to 15.
 */
function buildRisingStarHtml(headerFirstCell: string): string {
  const padTo15 = (cells: readonly string[]): string[] => {
    const out = [...cells];
    while (out.length < 15) out.push("");
    return out;
  };

  const header = tr(
    padTo15([headerFirstCell, "Name", "Team", "Opp", "K", "HB", "D", "M", "G", "B", "T"]),
  );

  const dataRow = (round: string, player: string, team: string, opp: string): string =>
    tr(padTo15([round, player, team, opp, "12", "8", "20", "5", "1", "2", "4"]));

  // Need ≥5 rows total: 1 header + 4 data rows.
  const rows = [
    header,
    dataRow("1", "Rookie One", "Blues", "Magpies"),
    dataRow("2", "Rookie Two", "Power", "Blues"),
    dataRow("3", "Rookie Three", "Magpies", "Power"),
    dataRow("4", "Rookie Four", "Blues", "Power"),
  ];

  return `<html><body><table>${rows.join("")}</table></body></html>`;
}

describe("parseRisingStarNominations", () => {
  it("parses nominations from a table with a 'Rd' header and stats columns", () => {
    const result = parseRisingStarNominations(buildRisingStarHtml("Rd"), 2024);

    expect(result).toHaveLength(4);
    const first = result.find((r) => r.player === "Rookie One");
    expect(first).toMatchObject({
      type: "rising-star",
      season: 2024,
      competition: "AFLM",
      source: "footywire",
      round: 1,
      player: "Rookie One",
      team: "Carlton",
      opponent: "Collingwood",
      kicks: 12,
      handballs: 8,
      disposals: 20,
      marks: 5,
      goals: 1,
      behinds: 2,
      tackles: 4,
    });
  });

  it("tolerates the long-form 'Round' header variant (#91 regression)", () => {
    const result = parseRisingStarNominations(buildRisingStarHtml("Round"), 2024);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.player).toBe("Rookie One");
  });

  it("tolerates the 'Rnd' header variant (#91 regression)", () => {
    const result = parseRisingStarNominations(buildRisingStarHtml("Rnd"), 2024);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.player).toBe("Rookie One");
  });

  it("returns [] when the header's first cell is unrelated", () => {
    expect(parseRisingStarNominations(buildRisingStarHtml("Player"), 2024)).toEqual([]);
  });
});
