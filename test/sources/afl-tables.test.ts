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

    // Quarter scores — per-quarter (not cumulative). Sum across all four
    // quarters equals the total (#103).
    expect(first.q1Home).toEqual({ goals: 3, behinds: 3, points: 21 });
    expect(first.q1Away).toEqual({ goals: 1, behinds: 6, points: 12 });
    const homeTotalFromQuarters =
      (first.q1Home?.points ?? 0) +
      (first.q2Home?.points ?? 0) +
      (first.q3Home?.points ?? 0) +
      (first.q4Home?.points ?? 0);
    expect(homeTotalFromQuarters).toBe(first.homePoints);

    // Metadata
    expect(first.attendance).toBe(40012);
    expect(first.venue).toBe("SCG");
    expect(first.date?.getUTCFullYear()).toBe(2024);
    expect(first.date?.getUTCMonth()).toBe(2); // March
    expect(first.date?.getUTCDate()).toBe(7);
  });

  it("remaps Opening Round to round 0 for 2024+ seasons (#102)", () => {
    const results = parseSeasonPage(fixtureHtml, 2024);

    // The fixture's "Round 1" is actually the AFL's Opening Round (4 games);
    // its "Round 2" is the AFL's Round 1. After remapping:
    expect(results[0]?.roundNumber).toBe(0);
    expect(results[0]?.roundName).toBe("Opening Round");
    expect(results[1]?.roundNumber).toBe(0);
    expect(results[2]?.roundNumber).toBe(1);
  });

  it("returns empty array for empty HTML", () => {
    expect(parseSeasonPage("<html></html>", 2024)).toEqual([]);
  });

  // 2025-10-05 02:00 → 03:00 AEDT in Australia/Melbourne, so 02:30 doesn't
  // exist. Previously the err branch silently mapped to midnight UTC; the
  // fix rolls forward one hour so 02:30 becomes 03:30 AEDT (16:30 UTC the
  // previous calendar day).
  it("DST spring-forward gap rolls forward one hour (Australia/Melbourne 2025-10-05)", () => {
    const dstGapHtml = `<html><body>
<table><tr><td>Round 1</td><td></td></tr></table>
<table border=1>
<tr><td><a href="../teams/melbourne_idx.html">Melbourne</a></td><td><tt>3.3 4.3 7.10 12.14</tt></td><td> 86</td><td>Sun 05-Oct-2025 2:30 AM <b>Venue:</b> <a href="../venues/mcg.html">M.C.G.</a></td></tr>
<tr><td><a href="../teams/carlton_idx.html">Carlton</a></td><td><tt>1.6 2.8 7.8 9.10</tt></td><td> 64</td><td><b>Melbourne</b> won by <b>22 pts </b></td></tr>
</table>
</body></html>`;

    const results = parseSeasonPage(dstGapHtml, 2025);
    expect(results).toHaveLength(1);
    const date = results[0]?.date;
    expect(date).toBeDefined();
    // 03:30 AEDT on Oct 5 == 16:30 UTC on Oct 4.
    expect(date?.getTime()).toBe(Date.UTC(2025, 9, 4, 16, 30));
  });

  it("does not roll forward on a non-gap Sunday at the same wall-clock (Australia/Melbourne 2025-10-12)", () => {
    const nonGapHtml = `<html><body>
<table><tr><td>Round 1</td><td></td></tr></table>
<table border=1>
<tr><td><a href="../teams/melbourne_idx.html">Melbourne</a></td><td><tt>3.3 4.3 7.10 12.14</tt></td><td> 86</td><td>Sun 12-Oct-2025 2:30 AM <b>Venue:</b> <a href="../venues/mcg.html">M.C.G.</a></td></tr>
<tr><td><a href="../teams/carlton_idx.html">Carlton</a></td><td><tt>1.6 2.8 7.8 9.10</tt></td><td> 64</td><td><b>Melbourne</b> won by <b>22 pts </b></td></tr>
</table>
</body></html>`;

    const results = parseSeasonPage(nonGapHtml, 2025);
    expect(results).toHaveLength(1);
    const date = results[0]?.date;
    expect(date).toBeDefined();
    // 02:30 AEDT on Oct 12 == 15:30 UTC on Oct 11. Critically, NOT
    // midnight UTC (the silent-fallback failure mode this test guards
    // against) and NOT the rolled-forward 03:30 AEDT.
    expect(date?.getTime()).toBe(Date.UTC(2025, 9, 11, 15, 30));
    expect(date?.getUTCHours()).not.toBe(0);
  });

  it("preserves a legitimate 0 attendance rather than nulling it", () => {
    // Behind-closed-doors 2020 COVID matches recorded "Att: 0". The old
    // `parseInt(...) || null` idiom collapsed that genuine 0 to null.
    const html = `<html><body>
<table><tr><td>Round 1</td><td></td></tr></table>
<table border=1>
<tr><td><a href="../teams/swans_idx.html">Sydney</a></td><td><tt>3.3 4.3 7.10 12.14</tt></td><td> 86</td><td>Thu 07-Mar-2024 7:30 PM <b>Att: </b>0 <b>Venue:</b> <a href="../venues/scg.html">S.C.G.</a></td></tr>
<tr><td><a href="../teams/melbourne_idx.html">Melbourne</a></td><td><tt>1.6 2.8 7.8 9.10</tt></td><td> 64</td><td><b>Sydney</b> won by <b>22 pts </b></td></tr>
</table>
</body></html>`;
    const results = parseSeasonPage(html, 2024);
    expect(results).toHaveLength(1);
    expect(results[0]?.attendance).toBe(0);
  });
});

// Season page with two matches that BOTH carry "Match stats" game links, so
// fetchSeasonPlayerStats has two game pages to scrape.
const seasonWithTwoGameLinksHtml = `<html><body>
<table><tr><td>Round 1</td><td></td></tr></table>
<table border=1>
<tr><td><a href="../teams/swans_idx.html">Sydney</a></td><td><tt>3.3 4.3 7.10 12.14</tt></td><td> 86</td><td>Thu 07-Mar-2024 7:30 PM <b>Att: </b>40,012 <b>Venue:</b> <a href="../venues/scg.html">S.C.G.</a></td></tr>
<tr><td><a href="../teams/melbourne_idx.html">Melbourne</a></td><td><tt>1.6 2.8 7.8 9.10</tt></td><td> 64</td><td><b>Sydney</b> won by <b>22 pts </b>[<a href="../stats/games/2024/111620240307.html">Match stats</a>]</td></tr>
</table>
<table border=1>
<tr><td><a href="../teams/brisbanel_idx.html">Brisbane Lions</a></td><td><tt>7.2 9.5 10.11 12.13</tt></td><td> 85</td><td>Fri 08-Mar-2024 6:40 PM <b>Att: </b>33,367 <b>Venue:</b> <a href="../venues/gabba.html">Gabba</a></td></tr>
<tr><td><a href="../teams/carlton_idx.html">Carlton</a></td><td><tt>2.0 4.4 11.6 13.8</tt></td><td> 86</td><td><b>Carlton</b> won by <b>1 pt </b>[<a href="../stats/games/2024/031420240308.html">Match stats</a>]</td></tr>
</table>
</body></html>`;

const GAME_STATS_FIXTURE = resolve(__dirname, "../fixtures/afltables-game-stats-2024-r1.html");
const gameStatsHtml = readFileSync(GAME_STATS_FIXTURE, "utf-8");

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

  describe("fetchSeasonPlayerStats (COR-03 partial-result envelope)", () => {
    it("reports a failed game in failedMatchIds while the rest of the season survives", async () => {
      const fetchFn = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/seas/2024.html")) {
          return Promise.resolve(new Response(seasonWithTwoGameLinksHtml, { status: 200 }));
        }
        if (url.includes("111620240307")) {
          return Promise.resolve(new Response(gameStatsHtml, { status: 200 }));
        }
        // Second game page 404s.
        return Promise.resolve(new Response("", { status: 404 }));
      });
      const client = new AflTablesClient({ fetchFn });

      const result = await client.fetchSeasonPlayerStats(2024);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.length).toBeGreaterThan(0);
      expect(result.data.stats[0]?.matchId).toBe("AT_111620240307");
      expect(result.data.failedMatchIds).toEqual(["AT_031420240308"]);
    });

    it("reports a game whose fetch throws in failedMatchIds", async () => {
      const fetchFn = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/seas/2024.html")) {
          return Promise.resolve(new Response(seasonWithTwoGameLinksHtml, { status: 200 }));
        }
        if (url.includes("111620240307")) {
          return Promise.resolve(new Response(gameStatsHtml, { status: 200 }));
        }
        return Promise.reject(new Error("Network error"));
      });
      const client = new AflTablesClient({ fetchFn });

      const result = await client.fetchSeasonPlayerStats(2024);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.length).toBeGreaterThan(0);
      expect(result.data.failedMatchIds).toEqual(["AT_031420240308"]);
    });

    it("returns empty failedMatchIds when every game succeeds", async () => {
      const fetchFn = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/seas/2024.html")) {
          return Promise.resolve(new Response(seasonWithTwoGameLinksHtml, { status: 200 }));
        }
        return Promise.resolve(new Response(gameStatsHtml, { status: 200 }));
      });
      const client = new AflTablesClient({ fetchFn });

      const result = await client.fetchSeasonPlayerStats(2024);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.stats.length).toBeGreaterThan(0);
      expect(result.data.failedMatchIds).toEqual([]);
    });

    it("still returns total err when the season page itself fails", async () => {
      const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
      const client = new AflTablesClient({ fetchFn });

      const result = await client.fetchSeasonPlayerStats(2024);

      expect(result.success).toBe(false);
    });

    it("keys round numbers by game id, so a skipped season-page row does not shift later rounds (COR-10)", async () => {
      // Round 1's match table is malformed (no team links) so parseSeasonPage
      // skips it, but its "Match stats" link is still picked up by the game-URL
      // extractor. With index-based alignment the Round 2 game would read the
      // round from results[1] (which doesn't exist) and fall back to 0.
      const seasonWithSkippedRowHtml = `<html><body>
<table><tr><td>Round 1</td><td></td></tr></table>
<table border=1>
<tr><td>Sydney</td><td><tt>3.3 4.3 7.10 12.14</tt></td><td> 86</td><td>Thu 07-Mar-2023 7:30 PM <b>Venue:</b> <a href="../venues/scg.html">S.C.G.</a></td></tr>
<tr><td>Melbourne</td><td><tt>1.6 2.8 7.8 9.10</tt></td><td> 64</td><td><b>Sydney</b> won by <b>22 pts </b>[<a href="../stats/games/2023/111620230307.html">Match stats</a>]</td></tr>
</table>
<table><tr><td>Round 2</td><td></td></tr></table>
<table border=1>
<tr><td><a href="../teams/geelong_idx.html">Geelong</a></td><td><tt>5.1 9.4 12.10 16.12</tt></td><td>108</td><td>Sat 16-Mar-2023 1:45 PM <b>Venue:</b> <a href="../venues/geel.html">K.S.</a></td></tr>
<tr><td><a href="../teams/adelaide_idx.html">Adelaide</a></td><td><tt>2.3 5.5 8.8 10.11</tt></td><td> 71</td><td><b>Geelong</b> won by <b>37 pts </b>[<a href="../stats/games/2023/031820230316.html">Match stats</a>]</td></tr>
</table>
</body></html>`;

      const fetchFn = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/seas/2023.html")) {
          return Promise.resolve(new Response(seasonWithSkippedRowHtml, { status: 200 }));
        }
        return Promise.resolve(new Response(gameStatsHtml, { status: 200 }));
      });
      const client = new AflTablesClient({ fetchFn });

      const result = await client.fetchSeasonPlayerStats(2023);

      expect(result.success).toBe(true);
      if (!result.success) return;
      const round2Stats = result.data.stats.filter((s) => s.matchId === "AT_031820230316");
      expect(round2Stats.length).toBeGreaterThan(0);
      expect(round2Stats[0]?.roundNumber).toBe(2);
    });
  });
});
