import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTeamStats } from "../../src/api/team-stats";
import { err, ok } from "../../src/lib/result";
import { AflTablesTeamStatsSource } from "../../src/sources/adapters/afl-tables";
import { teamStatsRegistry } from "../../src/sources/adapters/registry";
import type { AflTablesClient } from "../../src/sources/afl-tables";
import { parseAflTablesTeamStats } from "../../src/sources/afl-tables";
import { FootyWireClient, parseFootyWireTeamStats } from "../../src/sources/footywire";
import type { TeamStatsEntry } from "../../src/types";

const FW_FIXTURE = resolve(__dirname, "../fixtures/footywire-team-stats.html");
const FW_OPP_FIXTURE = resolve(__dirname, "../fixtures/footywire-team-stats-opp.html");
const AT_FIXTURE = resolve(__dirname, "../fixtures/afl-tables-team-stats.html");

const fwHtml = readFileSync(FW_FIXTURE, "utf-8");
const fwOppHtml = readFileSync(FW_OPP_FIXTURE, "utf-8");
const atHtml = readFileSync(AT_FIXTURE, "utf-8");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseFootyWireTeamStats", () => {
  it("returns intermediate per-direction entries with canonical metrics", () => {
    const entries = parseFootyWireTeamStats(fwHtml, 2024);

    expect(entries).toHaveLength(3);
    const teams = entries.map((e) => e.team);
    expect(teams).toContain("Carlton");
    expect(teams).toContain("Geelong Cats");
    expect(teams).toContain("Sydney Swans");

    const carlton = entries.find((e) => e.team === "Carlton");
    expect(carlton).toBeDefined();
    if (!carlton) return;

    expect(carlton.gamesPlayed).toBe(22);
    expect(carlton.metrics.kicks).toBe(3200);
    expect(carlton.metrics.handballs).toBe(2100);
    expect(carlton.metrics.disposals).toBe(5300);
    // Behinds canonicalisation also fixes the latent CLI bug where the
    // `B` table column rendered empty because FootyWire emitted `BH`. (#98)
    expect(carlton.metrics.behinds).not.toBeNull();
    expect(typeof carlton.metrics.behinds).toBe("number");
    // FootyWire-only metrics populated; AFL Tables-only stay null
    expect(carlton.metrics.brownlowVotes).toBeNull();
  });

  it("returns empty array for empty HTML", () => {
    expect(parseFootyWireTeamStats("<html></html>", 2024)).toEqual([]);
  });
});

describe("parseAflTablesTeamStats", () => {
  it("parses canonical for/against TeamMetricSet from fixture", () => {
    const entries = parseAflTablesTeamStats(atHtml, 2024);

    expect(entries).toHaveLength(2);
    const teams = entries.map((e) => e.team);
    expect(teams).toContain("Carlton");
    expect(teams).toContain("Geelong Cats");

    const carlton = entries.find((e) => e.team === "Carlton");
    expect(carlton).toBeDefined();
    if (!carlton) return;

    expect(carlton.competition).toBe("AFLM");
    expect(carlton.gamesPlayed).toBeNull();
    expect(carlton.for.kicks).toBe(3200);
    expect(carlton.against.kicks).toBe(3000);
    expect(carlton.source).toBe("afl-tables");
    // AFL Tables-only metric populated; FootyWire-only stay null
    expect(carlton.for.fantasyPoints).toBeNull();
  });

  it("returns empty array for empty HTML", () => {
    expect(parseAflTablesTeamStats("<html></html>", 2024)).toEqual([]);
  });
});

describe("AflTablesTeamStatsSource games-played enrichment", () => {
  const missingGames = parseAflTablesTeamStats(atHtml, 2024).map((entry) => ({
    ...entry,
    gamesPlayed: null,
  }));

  it("enriches missing denominators from successful match results", async () => {
    const client = {
      fetchTeamStats: vi.fn().mockResolvedValue(ok(missingGames)),
      fetchSeasonResults: vi.fn().mockResolvedValue(
        ok([
          { homeTeam: "Carlton", awayTeam: "Geelong Cats" },
          { homeTeam: "Carlton", awayTeam: "Richmond" },
        ]),
      ),
    } as unknown as AflTablesClient;

    const result = await new AflTablesTeamStatsSource(client).fetchTeamStats({
      source: "afl-tables",
      season: 2024,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.find((entry) => entry.team === "Carlton")?.gamesPlayed).toBe(2);
    expect(result.data.find((entry) => entry.team === "Geelong Cats")?.gamesPlayed).toBe(1);
  });

  it("returns totals with null denominators when enrichment fails", async () => {
    const client = {
      fetchTeamStats: vi.fn().mockResolvedValue(ok(missingGames)),
      fetchSeasonResults: vi.fn().mockResolvedValue(err(new Error("results unavailable"))),
    } as unknown as AflTablesClient;

    const result = await new AflTablesTeamStatsSource(client).fetchTeamStats({
      source: "afl-tables",
      season: 2024,
      summaryType: "totals",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.every((entry) => entry.gamesPlayed === null)).toBe(true);
  });

  it("rejects averages when any denominator remains missing", async () => {
    const client = {
      fetchTeamStats: vi.fn().mockResolvedValue(ok(missingGames)),
      fetchSeasonResults: vi.fn().mockResolvedValue(err(new Error("results unavailable"))),
    } as unknown as AflTablesClient;

    const result = await new AflTablesTeamStatsSource(client).fetchTeamStats({
      source: "afl-tables",
      season: 2024,
      summaryType: "averages",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("games played");
  });

  it("rejects averages when a denominator is non-positive", async () => {
    const zeroGames = missingGames.map((entry, index) => ({
      ...entry,
      gamesPlayed: index === 0 ? 0 : 1,
    }));
    const client = {
      fetchTeamStats: vi.fn().mockResolvedValue(ok(zeroGames)),
      fetchSeasonResults: vi.fn(),
    } as unknown as AflTablesClient;

    const result = await new AflTablesTeamStatsSource(client).fetchTeamStats({
      source: "afl-tables",
      season: 2024,
      summaryType: "averages",
    });

    expect(result.success).toBe(false);
    expect(client.fetchSeasonResults).not.toHaveBeenCalled();
  });
});

describe("FootyWireClient.fetchTeamStats", () => {
  it("fetches and merges team and opposition stats into canonical for/against", async () => {
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
      expect(carlton?.competition).toBe("AFLM");
      expect(carlton?.for.kicks).toBe(3200);
      expect(carlton?.against.kicks).toBe(3000);
      expect(carlton?.against.handballs).toBe(2000);
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
  it.each(["afl-api", "squiggle"] as const)(
    "returns error for unsupported %s source",
    async (source) => {
      const result = await fetchTeamStats({ source, season: 2024 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain(`${source} does not provide team stats`);
      }
    },
  );

  it("rejects an unsupported competition before adapter network access", async () => {
    const adapter = teamStatsRegistry.get("footywire");
    expect(adapter).toBeDefined();
    if (!adapter) return;
    const fetchSpy = vi.spyOn(adapter, "fetchTeamStats").mockResolvedValue(ok([]));

    const result = await fetchTeamStats({
      source: "footywire",
      season: 2024,
      competition: "AFLW",
    });

    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("defaults competition coverage to AFLM", async () => {
    const adapter = teamStatsRegistry.get("footywire");
    expect(adapter).toBeDefined();
    if (!adapter) return;
    const fetchSpy = vi.spyOn(adapter, "fetchTeamStats").mockResolvedValue(ok([]));

    const result = await fetchTeamStats({ source: "footywire", season: 2024 });

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("rejects averages with a missing denominator from any source", async () => {
    const adapter = teamStatsRegistry.get("footywire");
    expect(adapter).toBeDefined();
    if (!adapter) return;
    vi.spyOn(adapter, "fetchTeamStats").mockResolvedValue(
      ok([{ team: "Carlton", gamesPlayed: null } as TeamStatsEntry]),
    );

    const result = await fetchTeamStats({
      source: "footywire",
      season: 2024,
      summaryType: "averages",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain("games played");
  });
});
