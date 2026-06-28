// TODO(plan #7): no afl-api-player-details / afl-api-squad fixture
// captured; add a happy-path test once a squad-endpoint snapshot is
// available (fetchPlayerDetails is a denormalised view over fetchSquad).

import { afterEach, describe, expect, it, vi } from "vitest";

// Replace the squad fetch with a spy so the omitted-season test can assert
// which season fetchPlayerDetails passed downstream without stubbing the
// whole AFL API squad chain (auth → compseasons → teams → squad). The real
// default-season resolver still runs against the (stubbed) global fetch.
vi.mock("../../src/api/teams", () => ({
  fetchSquad: vi.fn(),
}));

import { fetchPlayerDetails } from "../../src/api/player-details";
import { fetchSquad } from "../../src/api/teams";
import { ok } from "../../src/lib/result";

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
    mockedFetchSquad.mockResolvedValue(
      ok({
        teamId: "1",
        teamName: "Carlton",
        season: 2024,
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
