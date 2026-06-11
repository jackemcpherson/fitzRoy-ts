import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FootyWirePlayerStatsSource } from "../../../src/sources/adapters/footywire";
import { FootyWireClient } from "../../../src/sources/footywire";

const matchListHtml = readFileSync(
  resolve(__dirname, "../../fixtures/footywire-match-list.html"),
  "utf-8",
);
const basicStatsHtml = readFileSync(
  resolve(__dirname, "../../fixtures/footywire-match-stats-basic-11174.html"),
  "utf-8",
);
const advancedStatsHtml = readFileSync(
  resolve(__dirname, "../../fixtures/footywire-match-stats-advanced-11174.html"),
  "utf-8",
);

/**
 * Build a fetch mock that serves the season match list and per-match stats
 * pages, failing the stats pages for the given match IDs.
 */
function buildFetchFn(failingMids: readonly string[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("ft_match_list")) {
      return Promise.resolve(new Response(matchListHtml, { status: 200 }));
    }
    if (failingMids.some((mid) => url.includes(`mid=${mid}`))) {
      return Promise.resolve(new Response("", { status: 404 }));
    }
    if (url.includes("advv=Y")) {
      return Promise.resolve(new Response(advancedStatsHtml, { status: 200 }));
    }
    return Promise.resolve(new Response(basicStatsHtml, { status: 200 }));
  });
}

describe("FootyWirePlayerStatsSource (COR-03 partial-result envelope)", () => {
  it("reports a failed match in failedMatchIds while the rest of the season survives", async () => {
    const client = new FootyWireClient({ fetchFn: buildFetchFn(["11194"]) });
    const source = new FootyWirePlayerStatsSource(client);

    const result = await source.fetchPlayerStats({ source: "footywire", season: 2025 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.stats.length).toBeGreaterThan(0);
    expect(result.data.failedMatchIds).toEqual(["FW_11194"]);
    // Surviving matches still contribute stat rows.
    const matchIds = new Set(result.data.stats.map((s) => s.matchId));
    expect(matchIds.has("FW_11193")).toBe(true);
    expect(matchIds.has("FW_11194")).toBe(false);
  });

  it("returns empty failedMatchIds when every match succeeds", async () => {
    const client = new FootyWireClient({ fetchFn: buildFetchFn([]) });
    const source = new FootyWirePlayerStatsSource(client);

    const result = await source.fetchPlayerStats({ source: "footywire", season: 2025 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.stats.length).toBeGreaterThan(0);
    expect(result.data.failedMatchIds).toEqual([]);
  });

  it("still returns total err when the match-list page itself fails", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    const client = new FootyWireClient({ fetchFn });
    const source = new FootyWirePlayerStatsSource(client);

    const result = await source.fetchPlayerStats({ source: "footywire", season: 2025 });

    expect(result.success).toBe(false);
  });
});
