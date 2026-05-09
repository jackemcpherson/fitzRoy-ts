/**
 * Tests for resolveMatchId — the precondition + prompt-fallback paths
 * that the team and stats CLI commands previously inlined.
 */

import { describe, expect, it } from "vitest";
import { resolveMatchId } from "../../src/cli/match-resolver";

describe("resolveMatchId", () => {
  it("returns matchIdArg unchanged when present (no fetch needed)", async () => {
    const result = await resolveMatchId({
      matchIdArg: "CD_M20250140101",
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
        competition: "AFLM",
        season: 2025,
        round: 1,
      }),
    ).rejects.toThrow(/Invalid --match-id "BAD_ID"/);
  });

  it("returns undefined when neither matchIdArg nor matchArg is given", async () => {
    const result = await resolveMatchId({
      competition: "AFLM",
      season: 2025,
      round: 1,
    });
    expect(result).toBeUndefined();
  });

  it("throws when matchArg is given without round (precondition)", async () => {
    await expect(
      resolveMatchId({
        matchArg: "Carlton",
        competition: "AFLM",
        season: 2025,
        round: undefined,
      }),
    ).rejects.toThrow(/--match requires --round/);
  });

  it("does not throw when round is given but matchArg is missing", async () => {
    const result = await resolveMatchId({
      competition: "AFLM",
      season: 2025,
      round: undefined,
    });
    expect(result).toBeUndefined();
  });
});
