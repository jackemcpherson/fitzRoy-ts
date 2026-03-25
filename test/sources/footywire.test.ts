import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FootyWireClient, parseMatchList } from "../../src/sources/footywire";

const FIXTURE_PATH = resolve(__dirname, "../fixtures/footywire-match-list.html");
const fixtureHtml = readFileSync(FIXTURE_PATH, "utf-8");

describe("parseMatchList", () => {
  it("parses match results from HTML fixture", () => {
    const results = parseMatchList(fixtureHtml, 2025);

    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("extracts round numbers from headers", () => {
    const results = parseMatchList(fixtureHtml, 2025);

    const round1 = results.filter((r) => r.roundNumber === 1);
    const round2 = results.filter((r) => r.roundNumber === 2);
    expect(round1.length).toBe(2);
    expect(round2.length).toBe(1);
  });

  it("extracts teams correctly", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    const first = results[0];

    expect(first?.homeTeam).toBe("Richmond");
    expect(first?.awayTeam).toBe("Carlton");
  });

  it("extracts scores", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    const first = results[0];

    expect(first?.homePoints).toBe(82);
    expect(first?.awayPoints).toBe(69);
    expect(first?.margin).toBe(13);
  });

  it("extracts venue", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    expect(results[0]?.venue).toBe("MCG");
    expect(results[1]?.venue).toBe("GMHBA Stadium");
  });

  it("extracts attendance", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    expect(results[0]?.attendance).toBe(85000);
  });

  it("sets source and competition", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    expect(results[0]?.source).toBe("footywire");
    expect(results[0]?.competition).toBe("AFLM");
  });

  it("generates match IDs from mid links", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    expect(results[0]?.matchId).toBe("FW_11193");
  });

  it("sets quarter scores to null (not available on match list page)", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    expect(results[0]?.q1Home).toBeNull();
    expect(results[0]?.q4Away).toBeNull();
  });

  it("normalises team names", () => {
    const results = parseMatchList(fixtureHtml, 2025);
    // Brisbane Lions should normalise
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
