import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fetchTeamStats } from "../../src/api/team-stats";
import { parseAflTablesTeamStats } from "../../src/sources/afl-tables";
import { FootyWireClient, parseFootyWireTeamStats } from "../../src/sources/footywire";

const FW_FIXTURE = resolve(__dirname, "../fixtures/footywire-team-stats.html");
const FW_OPP_FIXTURE = resolve(__dirname, "../fixtures/footywire-team-stats-opp.html");
const AT_FIXTURE = resolve(__dirname, "../fixtures/afl-tables-team-stats.html");

const fwHtml = readFileSync(FW_FIXTURE, "utf-8");
const fwOppHtml = readFileSync(FW_OPP_FIXTURE, "utf-8");
const atHtml = readFileSync(AT_FIXTURE, "utf-8");

describe("parseFootyWireTeamStats", () => {
  it("parses complete team stats from fixture", () => {
    const entries = parseFootyWireTeamStats(fwHtml, 2024, "for");

    expect(entries).toHaveLength(3);
    const teams = entries.map((e) => e.team);
    expect(teams).toContain("Carlton");
    expect(teams).toContain("Geelong Cats");
    expect(teams).toContain("Sydney Swans");

    const carlton = entries.find((e) => e.team === "Carlton");
    expect(carlton).toBeDefined();
    if (!carlton) return;

    expect(carlton.gamesPlayed).toBe(22);
    expect(carlton.stats.K).toBe(3200);
    expect(carlton.stats.HB).toBe(2100);
    expect(carlton.stats.D).toBe(5300);
    expect(carlton.season).toBe(2024);
    expect(carlton.source).toBe("footywire");
  });

  it("applies against suffix for opposition stats", () => {
    const entries = parseFootyWireTeamStats(fwOppHtml, 2024, "against");
    const carlton = entries.find((e) => e.team === "Carlton");
    expect(carlton?.stats.K_against).toBe(3000);
    expect(carlton?.stats.HB_against).toBe(2000);
  });

  it("returns empty array for empty HTML", () => {
    expect(parseFootyWireTeamStats("<html></html>", 2024, "for")).toEqual([]);
  });
});

describe("parseAflTablesTeamStats", () => {
  it("parses complete team stats from fixture", () => {
    const entries = parseAflTablesTeamStats(atHtml, 2024);

    expect(entries).toHaveLength(2);
    const teams = entries.map((e) => e.team);
    expect(teams).toContain("Carlton");
    expect(teams).toContain("Geelong Cats");

    const carlton = entries.find((e) => e.team === "Carlton");
    expect(carlton).toBeDefined();
    if (!carlton) return;

    expect(carlton.stats.KI_for).toBe(3200);
    expect(carlton.stats.KI_against).toBe(3000);
    expect(carlton.source).toBe("afl-tables");
  });

  it("returns empty array for empty HTML", () => {
    expect(parseAflTablesTeamStats("<html></html>", 2024)).toEqual([]);
  });
});

describe("FootyWireClient.fetchTeamStats", () => {
  it("fetches and merges team and opposition stats", async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(() => {
      callCount++;
      const html = callCount === 1 ? fwHtml : fwOppHtml;
      return Promise.resolve(new Response(html, { status: 200 }));
    });
    const client = new FootyWireClient({ fetchFn });

    const result = await client.fetchTeamStats(2024);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
      const carlton = result.data.find((e) => e.team === "Carlton");
      expect(carlton?.stats.K).toBe(3200);
      expect(carlton?.stats.K_against).toBe(3000);
    }
  });

  it("returns error on non-OK response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    const client = new FootyWireClient({ fetchFn });

    const result = await client.fetchTeamStats(2024);
    expect(result.success).toBe(false);
  });
});

describe("fetchTeamStats public API", () => {
  it.each([
    "afl-api",
    "squiggle",
  ] as const)("returns error for unsupported %s source", async (source) => {
    const result = await fetchTeamStats({ source, season: 2024 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain(`not available from ${source}`);
    }
  });
});
