/**
 * Tests for resolveMatchId — the precondition + prompt-fallback paths
 * that the team and stats CLI commands previously inlined.
 */

import { describe, expect, it } from "vitest";
import { matchIdForPlayerStatsSource, resolveMatchId } from "../../src/cli/match-resolver";

describe("matchIdForPlayerStatsSource", () => {
  const nameResolution = {
    matchId: "CD_M20250140101",
    participants: { homeTeam: "Carlton", awayTeam: "Richmond" },
  };

  it("keeps a name-resolved identifier for AFL API", () => {
    expect(matchIdForPlayerStatsSource("afl-api", nameResolution)).toBe("CD_M20250140101");
  });

  it.each(["footywire", "afl-tables", "fryzigg"] as const)(
    "uses participants instead of an AFL API identifier for %s",
    (source) => {
      expect(matchIdForPlayerStatsSource(source, nameResolution)).toBeUndefined();
    },
  );

  it("keeps an explicit provider identifier", () => {
    expect(matchIdForPlayerStatsSource("footywire", { matchId: "FW_11193" })).toBe("FW_11193");
  });
});

describe("resolveMatchId", () => {
  it("returns matchIdArg unchanged when present (no fetch needed)", async () => {
    const result = await resolveMatchId({
      matchIdArg: "CD_M20250140101",
      source: "afl-api",
      competition: "AFLM",
      season: 2025,
      round: 1,
    });
    expect(result).toEqual({ matchId: "CD_M20250140101" });
    expect(result?.participants).toBeUndefined();
  });

  it("returns matchIdArg even when matchArg is also given (matchIdArg wins)", async () => {
    const result = await resolveMatchId({
      matchIdArg: "CD_M20250140102",
      matchArg: "Carlton",
      source: "afl-api",
      competition: "AFLM",
      season: 2025,
      round: 1,
    });
    expect(result?.matchId).toBe("CD_M20250140102");
  });

  it("rejects malformed --match-id with a clear error (#95)", async () => {
    await expect(
      resolveMatchId({
        matchIdArg: "BAD_ID",
        source: "afl-api",
        competition: "AFLM",
        season: 2025,
        round: 1,
      }),
    ).rejects.toThrow(/Invalid match ID "BAD_ID" for afl-api/);
  });

  it.each([
    ["footywire", "FW_11193"],
    ["afl-tables", "AT_111620240307"],
    ["fryzigg", "10001"],
  ] as const)("accepts a valid %s identifier without fetching", async (source, matchId) => {
    await expect(
      resolveMatchId({ source, matchIdArg: matchId, competition: "AFLM", season: 2025, round: 1 }),
    ).resolves.toEqual({ matchId });
  });

  it("returns undefined when neither matchIdArg nor matchArg is given", async () => {
    const result = await resolveMatchId({
      competition: "AFLM",
      source: "afl-api",
      season: 2025,
      round: 1,
    });
    expect(result).toBeUndefined();
  });

  it("throws when matchArg is given without round (precondition)", async () => {
    await expect(
      resolveMatchId({
        matchArg: "Carlton",
        source: "afl-api",
        competition: "AFLM",
        season: 2025,
        round: undefined,
      }),
    ).rejects.toThrow(/--match requires --round/);
  });

  it("does not throw when round is given but matchArg is missing", async () => {
    const result = await resolveMatchId({
      competition: "AFLM",
      source: "afl-api",
      season: 2025,
      round: undefined,
    });
    expect(result).toBeUndefined();
  });
});
