import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AflTablesClient, parseSeasonPage } from "../../src/sources/afl-tables";

const FIXTURE_PATH = resolve(__dirname, "../fixtures/afl-tables-season.html");
const fixtureHtml = readFileSync(FIXTURE_PATH, "utf-8");

describe("parseSeasonPage", () => {
  it("parses complete match results from fixture", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results).toHaveLength(3);

    const first = results[0];
    expect(first).toBeDefined();
    if (!first) return;

    // Teams and identity
    expect(first.homeTeam).toBe("Sydney Swans");
    expect(first.awayTeam).toBe("Melbourne");
    expect(first.source).toBe("afl-tables");
    expect(first.competition).toBe("AFLM");

    // Scores
    expect(first.homePoints).toBe(86);
    expect(first.awayPoints).toBe(64);
    expect(first.margin).toBe(22);
    expect(first.homeGoals).toBe(12);
    expect(first.homeBehinds).toBe(14);
    expect(first.awayGoals).toBe(9);
    expect(first.awayBehinds).toBe(10);

    // Quarter scores
    expect(first.q1Home).toEqual({ goals: 3, behinds: 3, points: 21 });
    expect(first.q4Home).toEqual({ goals: 12, behinds: 14, points: 86 });
    expect(first.q1Away).toEqual({ goals: 1, behinds: 6, points: 12 });

    // Metadata
    expect(first.attendance).toBe(40012);
    expect(first.venue).toBe("S.C.G.");
    expect(first.date?.getUTCFullYear()).toBe(2024);
    expect(first.date?.getUTCMonth()).toBe(2); // March
    expect(first.date?.getUTCDate()).toBe(7);
  });

  it("extracts round numbers across multiple rounds", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    expect(results[0]?.roundNumber).toBe(1);
    expect(results[1]?.roundNumber).toBe(1);
    expect(results[2]?.roundNumber).toBe(2);
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
