import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTeams } from "../../src/api/teams";

/**
 * Build a fetch stub that returns an empty AFL `/teams` list. This drives
 * the AFLW backfill path in `src/api/teams.ts:53-60`: when the upstream
 * `WOMEN` filter yields zero teams, the four hardcoded AFLW senior clubs
 * (Essendon, Hawthorn, Sydney Swans, Port Adelaide) should be added.
 */
function buildEmptyTeamsFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/teams")) {
      return new Response(JSON.stringify({ teams: [] }), { status: 200 });
    }
    return new Response("unexpected URL", { status: 500 });
  }) as unknown as typeof fetch;
}

describe("fetchTeams public API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("augments AFLW with the four backfill senior clubs when upstream omits them", async () => {
    vi.stubGlobal("fetch", buildEmptyTeamsFetch());

    const result = await fetchTeams({ competition: "AFLW" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const names = result.data.map((t) => t.name).sort();
    expect(names).toContain("Essendon");
    expect(names).toContain("Hawthorn");
    expect(names).toContain("Sydney Swans");
    expect(names).toContain("Port Adelaide");
    expect(result.data).toHaveLength(4);

    for (const team of result.data) {
      expect(team.competition).toBe("AFLW");
      expect(team.source).toBe("afl-api");
    }
  });

  it("returns an empty list for AFLM when upstream returns no teams", async () => {
    // AFLM path filters by AFL_SENIOR_TEAMS allow-list and does NOT backfill,
    // so an empty upstream response yields an empty list. Locks in the
    // contrast with the AFLW backfill above.
    vi.stubGlobal("fetch", buildEmptyTeamsFetch());

    const result = await fetchTeams({ competition: "AFLM" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("returns AFLM + AFLW combined when no competition is specified", async () => {
    // With empty upstream, AFLM contributes 0 and AFLW contributes the 4
    // backfill teams — exercises the dual-fetch branch in fetchTeams.
    vi.stubGlobal("fetch", buildEmptyTeamsFetch());

    const result = await fetchTeams();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(4);
    const competitions = new Set(result.data.map((t) => t.competition));
    expect(competitions.has("AFLW")).toBe(true);
  });
});
