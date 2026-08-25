import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSquad } from "../../src/api/teams";

const COMPSEASONS = readFileSync(
  resolve(__dirname, "../fixtures/afl-api-compseasons-2024.json"),
  "utf-8",
);
const TEAMS = readFileSync(resolve(__dirname, "../fixtures/afl-api-teams-aflm.json"), "utf-8");
const SQUAD = readFileSync(
  resolve(__dirname, "../fixtures/afl-api-squads-carlton-2024.json"),
  "utf-8",
);

/**
 * Route each AFL-API URL the squad flow requests to its fixture. The
 * shared `aflApiClient` defers its `globalThis.fetch` lookup to call time
 * (see `createSourceFetch`), so stubbing the global intercepts the
 * import-time singleton used by `fetchSquad`.
 */
function squadFetch(): typeof fetch {
  return vi.fn((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("compseasons?pageSize")) {
      return Promise.resolve(new Response(COMPSEASONS, { status: 200 }));
    }
    if (url.includes("/teams?")) {
      return Promise.resolve(new Response(TEAMS, { status: 200 }));
    }
    if (url.includes("/squads?")) {
      return Promise.resolve(new Response(SQUAD, { status: 200 }));
    }
    return Promise.reject(new Error(`Unexpected URL in squad test: ${url}`));
  }) as unknown as typeof fetch;
}

describe("fetchSquad afl-api happy path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves comp-season, team id, then squad and maps players", async () => {
    vi.stubGlobal("fetch", squadFetch());

    const result = await fetchSquad({ team: "Carlton", season: 2024, source: "afl-api" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.teamName).toBe("Carlton");
    expect(result.data.teamId).toBe("5");
    expect(result.data.season).toBe(2024);
    expect(result.data.scope).toBe("season");
    expect(result.data.competition).toBe("AFLM");
    expect(result.data.source).toBe("afl-api");
    expect(result.data.players).toHaveLength(2);

    const cripps = result.data.players.find((p) => p.surname === "Cripps");
    expect(cripps).toBeDefined();
    expect(cripps?.displayName).toBe("Patrick Cripps");
    expect(cripps?.jumperNumber).toBe(9);
    expect(cripps?.team).toBe("Carlton");
    expect(cripps?.playerId).toBe("CD_I1000900");
    expect(cripps?.draftYear).toBe(2013);
    expect(cripps?.heightCm).toBe(195);
    // AFL API squad endpoint carries no career counters.
    expect(cripps?.gamesPlayed).toBeNull();
  });
});

describe("fetchSquad public API dispatch", () => {
  it("returns error for unsupported squiggle source", async () => {
    const result = await fetchSquad({
      team: "Carlton",
      season: 2024,
      source: "squiggle",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("squiggle does not provide squad");
    }
  });

  it("returns error for fryzigg source (player-stats only, not squad)", async () => {
    const result = await fetchSquad({
      team: "Carlton",
      season: 2024,
      source: "fryzigg",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("fryzigg does not provide squad");
    }
  });

  it("returns error for season below afl-api coverage (pre-2012)", async () => {
    const result = await fetchSquad({
      team: "Carlton",
      season: 2010,
      source: "afl-api",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("2010");
    }
  });
});
