import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// `fetchSquad` is wrapped as a spy that calls through to the real
// implementation by default, so the happy-path test below still exercises the
// real comp-season → team-id → squad chain (via the stubbed global fetch). The
// default-season test (#149) overrides it with `mockResolvedValue` to assert
// which season `fetchPlayerDetails` passed downstream, without re-stubbing the
// whole chain.
vi.mock("../../src/api/teams", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api/teams")>();
  return { ...actual, fetchSquad: vi.fn(actual.fetchSquad) };
});

import { fetchPlayerDetails } from "../../src/api/player-details";
import { fetchSquad } from "../../src/api/teams";
import { err, ok } from "../../src/lib/result";
import { AFL_SENIOR_TEAMS } from "../../src/lib/team-mapping";
import type { Player } from "../../src/types";

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

    expect(result.data.players).toHaveLength(2);
    expect(result.data.failedTeams).toEqual([]);
    expect(result.data.scope).toBe("season");

    const walsh = result.data.players.find((p) => p.surname === "Walsh");
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

describe("fetchPlayerDetails default-season resolution (#149)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.mocked(fetchSquad).mockReset();
  });

  it("resolves the omitted season via the data-driven resolver (offline fallback), not new Date().getFullYear()", async () => {
    // Mid-June 2025: new Date().getFullYear() === 2025. Force the data-driven
    // resolver's network lookup to fail (every fetch returns 500) so
    // resolveDefaultSeasonForCompetition falls back to the sync
    // resolveDefaultSeason("AFLW") = year - 1 = 2024. Asserting 2024 (not the
    // calendar year 2025) flowed into fetchSquad proves the default now flows
    // through the resolver instead of a hard-coded getFullYear().
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T00:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 500, statusText: "Server Error" })),
    );

    const mockedFetchSquad = vi.mocked(fetchSquad);
    // Reset first: the happy-path test above calls through the same spy, so
    // clear its recorded call before asserting this test's call count.
    mockedFetchSquad.mockReset();
    mockedFetchSquad.mockResolvedValue(
      ok({
        teamId: "1",
        teamName: "Carlton",
        season: 2024,
        scope: "season",
        players: [],
        competition: "AFLW",
        source: "afl-api",
      }),
    );

    const result = await fetchPlayerDetails({
      source: "afl-api",
      team: "Carlton",
      competition: "AFLW",
    });

    expect(result.success).toBe(true);
    expect(mockedFetchSquad).toHaveBeenCalledTimes(1);
    expect(mockedFetchSquad).toHaveBeenCalledWith(
      expect.objectContaining({ team: "Carlton", competition: "AFLW", season: 2024 }),
    );
  });
});

describe("fetchPlayerDetails all-teams failure modes (#155)", () => {
  afterEach(() => {
    vi.mocked(fetchSquad).mockReset();
  });

  it("returns an error when every team squad fetch fails", async () => {
    vi.mocked(fetchSquad).mockResolvedValue(err(new Error("network failure")));

    const result = await fetchPlayerDetails({ source: "afl-api", season: 2024 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("2024");
      expect(result.error.message).toContain("afl-api");
    }
  });

  it("returns partial results when some team squad fetches fail", async () => {
    const mockPlayer: Player = {
      playerId: "1",
      givenName: "Sam",
      surname: "Walsh",
      displayName: "Sam Walsh",
      jumperNumber: 3,
      position: null,
      dateOfBirth: null,
      heightCm: null,
      weightKg: null,
      draftYear: null,
      draftPosition: null,
      draftType: null,
      debutYear: null,
      recruitedFrom: null,
      gamesPlayed: null,
      goals: null,
      team: "Carlton",
      source: "afl-api",
      competition: "AFLM",
    };
    vi.mocked(fetchSquad).mockImplementation(async (query) => {
      if (query.team === "Carlton") {
        return ok({
          teamId: "1",
          teamName: "Carlton",
          season: 2024,
          scope: "season",
          players: [mockPlayer],
          competition: "AFLM",
          source: "afl-api",
        });
      }
      return err(new Error("network failure"));
    });

    const result = await fetchPlayerDetails({ source: "afl-api", season: 2024 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    // The one successful Carlton squad contributes exactly one player.
    expect(result.data.players).toHaveLength(1);
    expect(result.data.players[0]?.displayName).toBe("Sam Walsh");
    expect(result.data.players[0]?.team).toBe("Carlton");
    expect(result.data.failedTeams).toEqual(
      [...AFL_SENIOR_TEAMS].filter((team) => team !== "Carlton"),
    );
    expect(result.data.scope).toBe("season");
  });
});

describe("fetchPlayerDetails scope", () => {
  afterEach(() => {
    vi.mocked(fetchSquad).mockReset();
  });

  it("reports all-time scope from scraped player lists", async () => {
    vi.mocked(fetchSquad).mockResolvedValue(
      ok({
        teamId: "Carlton",
        teamName: "Carlton",
        season: 2024,
        scope: "all-time",
        players: [],
        competition: "AFLM",
        source: "footywire",
      }),
    );

    const result = await fetchPlayerDetails({
      source: "footywire",
      team: "Carlton",
      season: 2024,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scope).toBe("all-time");
    expect(result.data.failedTeams).toEqual([]);
  });
});
