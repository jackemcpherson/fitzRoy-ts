import { describe, expect, it } from "vitest";
import { filterSeasonPlayerStats } from "../../src/transforms/player-stats-query";
import type { PlayerStats } from "../../src/types";

function stat(matchId: string): PlayerStats {
  return { matchId } as PlayerStats;
}

describe("filterSeasonPlayerStats", () => {
  it.each(["CD_M20250140101", "FW_11193", "AT_111620240307", "10001"])(
    "filters rows and failures by the exact %s identifier",
    (matchId) => {
      const result = filterSeasonPlayerStats(
        {
          stats: [stat(matchId), stat(`${matchId}_other`)],
          failedMatchIds: [`${matchId}_other`, matchId],
        },
        matchId,
      );

      expect(result.stats.map((entry) => entry.matchId)).toEqual([matchId]);
      expect(result.failedMatchIds).toEqual([matchId]);
    },
  );

  it("preserves the envelope when no match identifier is requested", () => {
    const input = { stats: [stat("FW_1")], failedMatchIds: ["FW_2"] };
    expect(filterSeasonPlayerStats(input, undefined)).toBe(input);
  });
});
