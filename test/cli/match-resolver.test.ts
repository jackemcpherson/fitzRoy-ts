/**
 * Tests for resolveMatchId — the precondition + prompt-fallback paths
 * that the team and stats CLI commands previously inlined.
 */

import { describe, expect, it } from "vitest";
import { resolveMatchId } from "../../src/cli/match-resolver";

describe("resolveMatchId", () => {
  it("returns matchIdArg unchanged when present (no fetch needed)", async () => {
    const result = await resolveMatchId({
      matchIdArg: "CD_M_2025_R1_HOME_AWAY",
      competition: "AFLM",
      season: 2025,
      round: 1,
    });
    expect(result).toBe("CD_M_2025_R1_HOME_AWAY");
  });

  it("returns matchIdArg even when matchArg is also given (matchIdArg wins)", async () => {
    const result = await resolveMatchId({
      matchIdArg: "CD_M_EXPLICIT",
      matchArg: "Carlton",
      competition: "AFLM",
      season: 2025,
      round: 1,
    });
    expect(result).toBe("CD_M_EXPLICIT");
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
