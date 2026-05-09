import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FootyWireClient, parseFixtureList, parseMatchList } from "../../src/sources/footywire";

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

describe("parseFixtureList (#122)", () => {
  it("populates homePoints/awayPoints/margin/goals/behinds when score is present", () => {
    const fixtures = parseFixtureList(fixtureHtml, 2025);
    const completed = fixtures.filter((f) => f.status === "Complete");
    expect(completed.length).toBeGreaterThan(0);

    const first = completed[0];
    expect(first).toBeDefined();
    if (!first) return;

    // Same fixture as parseMatchList's first row: Richmond v Carlton 82-69.
    expect(first.homeTeam).toBe("Richmond");
    expect(first.awayTeam).toBe("Carlton");
    expect(first.homePoints).toBe(82);
    expect(first.awayPoints).toBe(69);
    expect(first.margin).toBe(13);
    // Goals/behinds estimated from the total (FootyWire match list only
    // exposes total points): 82 = 13.4, 69 = 11.3
    expect(first.homeGoals).toBe(13);
    expect(first.homeBehinds).toBe(4);
    expect(first.awayGoals).toBe(11);
    expect(first.awayBehinds).toBe(3);
  });

  it("leaves scores null for upcoming matches", () => {
    // Synthesise a row with no score column populated.
    const html = `<html><body><table>
      <tr><td colspan="7">Round 5</td></tr>
      <tr>
        <td class="data">Sat 1 May 7:30pm</td>
        <td class="data"><a>Hawthorn</a><br><a>Geelong Cats</a></td>
        <td class="data">MCG</td>
        <td class="data">12345</td>
        <td class="data"></td>
      </tr>
    </table></body></html>`;
    const fixtures = parseFixtureList(html, 2025);
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]?.status).toBe("Upcoming");
    expect(fixtures[0]?.homePoints).toBeNull();
    expect(fixtures[0]?.awayPoints).toBeNull();
    expect(fixtures[0]?.margin).toBeNull();
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
