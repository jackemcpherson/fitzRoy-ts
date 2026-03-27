import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FootyWireClient, parseMatchList } from "../../src/sources/footywire";

const FIXTURE_PATH = resolve(__dirname, "../fixtures/footywire-match-list.html");
const fixtureHtml = readFileSync(FIXTURE_PATH, "utf-8");

describe("parseMatchList", () => {
  it("parses complete match results from fixture", () => {
    const results = parseMatchList(fixtureHtml, 2025);

    expect(results.length).toBeGreaterThanOrEqual(3);

    const first = results[0];
    expect(first).toBeDefined();
    if (!first) return;

    // Teams and identity
    expect(first.homeTeam).toBe("Richmond");
    expect(first.awayTeam).toBe("Carlton");
    expect(first.matchId).toBe("FW_11193");
    expect(first.source).toBe("footywire");
    expect(first.competition).toBe("AFLM");

    // Scores
    expect(first.homePoints).toBe(82);
    expect(first.awayPoints).toBe(69);
    expect(first.margin).toBe(13);

    // Metadata
    expect(first.venue).toBe("MCG");
    expect(first.attendance).toBe(85000);

    // Quarter scores not available on match list page
    expect(first.q1Home).toBeNull();
    expect(first.q4Away).toBeNull();
  });

  it("extracts round numbers from headers", () => {
    const results = parseMatchList(fixtureHtml, 2025);

    expect(results.filter((r) => r.roundNumber === 1)).toHaveLength(2);
    expect(results.filter((r) => r.roundNumber === 2)).toHaveLength(1);
  });

  it("normalises team names", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    expect(results[1]?.awayTeam).toBe("Brisbane Lions");
  });

  it("returns empty array for empty HTML", () => {
    expect(parseMatchList("<html></html>", 2025)).toEqual([]);
  });
});

describe("FootyWireClient", () => {
  it("fetches and parses season results", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(fixtureHtml, { status: 200 }));
    const client = new FootyWireClient({ fetchFn });

    const result = await client.fetchSeasonResults(2025);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns error on non-OK response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    const client = new FootyWireClient({ fetchFn });

    const result = await client.fetchSeasonResults(2025);
    expect(result.success).toBe(false);
  });

  it("returns error on network failure", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("Network error"));
    const client = new FootyWireClient({ fetchFn });

    const result = await client.fetchSeasonResults(2025);
    expect(result.success).toBe(false);
  });
});
