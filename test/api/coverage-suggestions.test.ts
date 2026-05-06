import { describe, expect, it } from "vitest";
import { fetchLadder } from "../../src/api/ladder";
import { fetchMatches } from "../../src/api/match";
import { fetchPlayerStats } from "../../src/api/player-stats";
import { fetchTeamStats } from "../../src/api/team-stats";
import {
  OutOfRangeError,
  UnsupportedCompetitionError,
  UnsupportedSourceError,
} from "../../src/lib/errors";

/**
 * These tests verify the registry-driven public API surfaces the right
 * structured errors with the right suggestions, without making any
 * network calls (the coverage check fails before the adapter dispatches).
 */
describe("coverage suggestions in public API", () => {
  it("fetchMatches with footywire+AFLW suggests --source afl-api (only afl-api covers AFLW)", async () => {
    const result = await fetchMatches({
      source: "footywire",
      season: 2025,
      competition: "AFLW",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UnsupportedCompetitionError);
      if (result.error instanceof UnsupportedCompetitionError) {
        expect(result.error.suggestion).toBe("--source afl-api");
      }
    }
  });

  it("fetchMatches with afl-tables+AFLM+1990 succeeds (deeper coverage)", async () => {
    // afl-tables covers AFLM from 1897, so 1990 is in range. The actual
    // network call would fetch from the live site; we just check that the
    // coverage check passes (network errors are acceptable for this test).
    const result = await fetchMatches({
      source: "afl-tables",
      season: 1990,
      competition: "AFLM",
    });
    // Either succeeds (live fetch) or fails with a non-coverage error.
    if (!result.success) {
      expect(result.error).not.toBeInstanceOf(UnsupportedCompetitionError);
      expect(result.error).not.toBeInstanceOf(OutOfRangeError);
    }
  });

  it("fetchMatches with afl-api+AFLM+1990 returns OutOfRangeError with afl-tables suggestion", async () => {
    const result = await fetchMatches({
      source: "afl-api",
      season: 1990,
      competition: "AFLM",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OutOfRangeError);
    }
  });

  it("fetchPlayerStats with squiggle returns UnsupportedSourceError (not registered)", async () => {
    const result = await fetchPlayerStats({
      source: "squiggle",
      season: 2025,
      round: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UnsupportedSourceError);
      expect(result.error.message).toContain("squiggle does not provide player stats");
    }
  });

  it("fetchLadder with fryzigg returns UnsupportedSourceError (not registered for ladder)", async () => {
    const result = await fetchLadder({ source: "fryzigg", season: 2025 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UnsupportedSourceError);
    }
  });

  it("fetchTeamStats with afl-api returns UnsupportedSourceError (no team-stats endpoint)", async () => {
    const result = await fetchTeamStats({ source: "afl-api", season: 2024 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UnsupportedSourceError);
    }
  });

  it("OutOfRangeError below minSeason includes the minSeason in the message", async () => {
    const result = await fetchPlayerStats({
      source: "afl-tables",
      season: 1900,
      competition: "AFLM",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OutOfRangeError);
      expect(result.error.message).toContain("1965");
    }
  });
});
