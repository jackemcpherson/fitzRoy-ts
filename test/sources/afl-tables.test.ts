import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AflTablesClient, parseSeasonPage } from "../../src/sources/afl-tables";

const FIXTURE_PATH = resolve(__dirname, "../fixtures/afl-tables-season.html");
const fixtureHtml = readFileSync(FIXTURE_PATH, "utf-8");

describe("parseSeasonPage", () => {
  it("parses match results from HTML fixture", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results).toHaveLength(3);
  });

  it("extracts round numbers", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results[0]?.roundNumber).toBe(1);
    expect(results[1]?.roundNumber).toBe(1);
    expect(results[2]?.roundNumber).toBe(2);
  });

  it("extracts teams correctly", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results[0]?.homeTeam).toBe("Sydney");
    expect(results[0]?.awayTeam).toBe("Melbourne");
    expect(results[1]?.homeTeam).toBe("Brisbane Lions");
    expect(results[1]?.awayTeam).toBe("Carlton");
  });

  it("extracts total scores", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results[0]?.homePoints).toBe(86);
    expect(results[0]?.awayPoints).toBe(64);
    expect(results[0]?.margin).toBe(22);
  });

  it("extracts per-quarter scores", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);
    const first = results[0];

    // AFL Tables gives cumulative: "3.3  4.3  7.10 12.14"
    expect(first?.q1Home).toEqual({ goals: 3, behinds: 3, points: 21 });
    expect(first?.q4Home).toEqual({ goals: 12, behinds: 14, points: 86 });
    expect(first?.q1Away).toEqual({ goals: 1, behinds: 6, points: 12 });
  });

  it("extracts final goals and behinds", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results[0]?.homeGoals).toBe(12);
    expect(results[0]?.homeBehinds).toBe(14);
    expect(results[0]?.awayGoals).toBe(9);
    expect(results[0]?.awayBehinds).toBe(10);
  });

  it("extracts attendance", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results[0]?.attendance).toBe(40012);
    expect(results[1]?.attendance).toBe(33367);
  });

  it("extracts venue from link text", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results[0]?.venue).toBe("S.C.G.");
    expect(results[1]?.venue).toBe("Gabba");
  });

  it("parses date correctly", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);
    const date = results[0]?.date;

    expect(date?.getUTCFullYear()).toBe(2024);
    expect(date?.getUTCMonth()).toBe(2); // March
    expect(date?.getUTCDate()).toBe(7);
  });

  it("sets source and competition", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results[0]?.source).toBe("afl-tables");
    expect(results[0]?.competition).toBe("AFLM");
  });

  it("returns empty array for empty HTML", () => {
    expect(parseSeasonPage("<html></html>", 2024)).toEqual([]);
  });
});

describe("AflTablesClient", () => {
  it("fetches and parses season results", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(fixtureHtml, { status: 200 }));
    const client = new AflTablesClient({ fetchFn });

    const result = await client.fetchSeasonResults(2024);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
    }
  });

  it("returns error on non-OK response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const client = new AflTablesClient({ fetchFn });

    const result = await client.fetchSeasonResults(2024);

    expect(result.success).toBe(false);
  });
});
