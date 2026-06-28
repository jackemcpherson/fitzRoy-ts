import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLadder } from "../../src/api/ladder";

const COMPSEASONS = readFileSync(
  resolve(__dirname, "../fixtures/afl-api-compseasons-2024.json"),
  "utf-8",
);
const ROUNDS = readFileSync(resolve(__dirname, "../fixtures/afl-api-rounds-2024.json"), "utf-8");
const LADDER = readFileSync(
  resolve(__dirname, "../fixtures/afl-api-ladder-2024-r10.json"),
  "utf-8",
);

/**
 * Route each AFL-API URL the ladder flow requests to its fixture. The
 * shared `aflApiClient` defers its `globalThis.fetch` lookup to call time
 * (see `createSourceFetch`), so stubbing the global intercepts the
 * import-time singleton used by `fetchLadder`.
 */
function ladderFetch(): typeof fetch {
  return vi.fn((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("compseasons?pageSize")) {
      return Promise.resolve(new Response(COMPSEASONS, { status: 200 }));
    }
    if (url.includes("/rounds?")) {
      return Promise.resolve(new Response(ROUNDS, { status: 200 }));
    }
    if (url.includes("/ladders")) {
      return Promise.resolve(new Response(LADDER, { status: 200 }));
    }
    return Promise.reject(new Error(`Unexpected URL in ladder test: ${url}`));
  }) as unknown as typeof fetch;
}

describe("fetchLadder afl-api happy path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves comp-season, rounds, then ladder and flattens entries", async () => {
    vi.stubGlobal("fetch", ladderFetch());

    const result = await fetchLadder({ source: "afl-api", season: 2024 });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.season).toBe(2024);
    expect(result.data.competition).toBe("AFLM");
    expect(result.data.source).toBe("afl-api");
    expect(result.data.roundNumber).toBe(10);
    expect(result.data.entries).toHaveLength(18);

    const leader = result.data.entries[0];
    expect(leader?.position).toBe(1);
    expect(leader?.team).toBe("Sydney Swans");
    expect(leader?.wins).toBe(9);
    expect(leader?.losses).toBe(1);
    expect(leader?.premiershipsPoints).toBe(36);
    expect(leader?.percentage).toBe(154.7);
  });

  it("honours an explicit round number", async () => {
    vi.stubGlobal("fetch", ladderFetch());

    const result = await fetchLadder({ source: "afl-api", season: 2024, round: 10 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.entries[0]?.team).toBe("Sydney Swans");
  });
});

describe("fetchLadder public API dispatch", () => {
  it("returns error for footywire source (not registered for ladder)", async () => {
    const result = await fetchLadder({
      source: "footywire",
      season: 2024,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("footywire does not provide ladder");
    }
  });

  it("returns error for fryzigg source (not registered for ladder)", async () => {
    const result = await fetchLadder({
      source: "fryzigg",
      season: 2024,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("fryzigg does not provide ladder");
    }
  });

  it("returns error for season below afl-api coverage (pre-2012)", async () => {
    const result = await fetchLadder({
      source: "afl-api",
      season: 2010,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("2010");
    }
  });

  it("returns error for AFLW season below afl-api coverage (pre-2017)", async () => {
    const result = await fetchLadder({
      source: "afl-api",
      season: 2016,
      competition: "AFLW",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("2016");
    }
  });
});
