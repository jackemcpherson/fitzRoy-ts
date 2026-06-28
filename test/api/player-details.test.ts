import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPlayerDetails } from "../../src/api/player-details";

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
 * `fetchPlayerDetails` is a denormalised view over `fetchSquad`, so the
 * single-team flow makes the same comp-season → team-id → squad chain.
 * The shared `aflApiClient` defers its `globalThis.fetch` lookup to call
 * time, so stubbing the global intercepts the import-time singleton.
 */
function playerDetailsFetch(): typeof fetch {
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
    return Promise.reject(new Error(`Unexpected URL in player-details test: ${url}`));
  }) as unknown as typeof fetch;
}

describe("fetchPlayerDetails afl-api happy path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("projects a single team's squad into flat player-detail rows", async () => {
    vi.stubGlobal("fetch", playerDetailsFetch());

    const result = await fetchPlayerDetails({ source: "afl-api", team: "Carlton", season: 2024 });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);

    const walsh = result.data.find((p) => p.surname === "Walsh");
    expect(walsh).toBeDefined();
    expect(walsh?.displayName).toBe("Sam Walsh");
    expect(walsh?.team).toBe("Carlton");
    expect(walsh?.jumperNumber).toBe(3);
    expect(walsh?.draftPosition).toBe(1);
    expect(walsh?.source).toBe("afl-api");
    expect(walsh?.competition).toBe("AFLM");
  });
});

describe("fetchPlayerDetails public API dispatch", () => {
  it("returns error for fryzigg source (player-stats only, no squad capability)", async () => {
    // Regression guard for #126: before the dispatch guard was added,
    // sources without a squad capability silently returned [] for every
    // team and produced an empty array with exit 0.
    const result = await fetchPlayerDetails({
      source: "fryzigg",
      team: "Carlton",
      season: 2024,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("fryzigg does not provide squad");
    }
  });

  it("returns error for squiggle source (no squad capability)", async () => {
    const result = await fetchPlayerDetails({
      source: "squiggle",
      team: "Carlton",
      season: 2024,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("squiggle does not provide squad");
    }
  });

  it("returns error for season below afl-api coverage (pre-2012)", async () => {
    const result = await fetchPlayerDetails({
      source: "afl-api",
      team: "Carlton",
      season: 2010,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("2010");
    }
  });
});
