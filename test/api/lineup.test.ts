import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLineup } from "../../src/api/lineup";

const ROSTER_FIXTURE = resolve(__dirname, "../fixtures/afl-api-match-roster-2025.json");
const rosterJson = readFileSync(ROSTER_FIXTURE, "utf-8");

/** Build a fetch stub that answers the WMCTok POST + matchRoster GET. */
function buildMockFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("WMCTok")) {
      return new Response(JSON.stringify({ token: "test-token" }), { status: 200 });
    }
    if (url.includes("/matchRoster/full/")) {
      return new Response(rosterJson, { status: 200 });
    }
    return new Response("unexpected URL", { status: 500 });
  }) as unknown as typeof fetch;
}

describe("fetchLineup public API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a one-element Lineup array for an explicit matchId", async () => {
    vi.stubGlobal("fetch", buildMockFetch());

    const result = await fetchLineup({
      source: "afl-api",
      season: 2025,
      round: 1,
      matchId: "CD_M20250140101",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);
    const lineup = result.data[0];
    expect(lineup).toBeDefined();
    if (!lineup) return;
    expect(lineup.matchId).toBe("CD_M20250140101");
    expect(lineup.season).toBe(2025);
    expect(lineup.roundNumber).toBe(1);
    expect(lineup.homeTeam).toBe("Richmond");
    expect(lineup.awayTeam).toBe("Carlton");
    expect(lineup.competition).toBe("AFLM");
    expect(lineup.source).toBe("afl-api");
    expect(Array.isArray(lineup.homePlayers)).toBe(true);
    expect(Array.isArray(lineup.awayPlayers)).toBe(true);
  });

  it("returns error for non-afl-api source (footywire)", async () => {
    const result = await fetchLineup({
      source: "footywire",
      season: 2025,
      round: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("footywire does not provide lineup");
    }
  });

  it("returns error for non-afl-api source (afl-tables)", async () => {
    const result = await fetchLineup({
      source: "afl-tables",
      season: 2025,
      round: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("afl-tables does not provide lineup");
    }
  });

  it("returns error for season below afl-api coverage (pre-2012)", async () => {
    const result = await fetchLineup({
      source: "afl-api",
      season: 2010,
      round: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("2010");
    }
  });
});
