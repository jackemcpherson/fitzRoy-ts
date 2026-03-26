import { describe, expect, it } from "vitest";
import { fetchLadder } from "../../src/api/ladder";
import { fetchLineup } from "../../src/api/lineup";
import { fetchPlayerStats } from "../../src/api/player-stats";

describe("public API source validation", () => {
  it("fetchPlayerStats returns error for unsupported footywire source", async () => {
    const result = await fetchPlayerStats({
      source: "footywire",
      season: 2025,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("not yet supported");
    }
  });

  it("fetchPlayerStats returns error for unsupported afl-tables source", async () => {
    const result = await fetchPlayerStats({
      source: "afl-tables",
      season: 2025,
    });
    expect(result.success).toBe(false);
  });

  it("fetchLineup returns error for non-afl-api source", async () => {
    const result = await fetchLineup({
      source: "footywire",
      season: 2025,
      round: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("only available from the AFL API");
    }
  });

  it("fetchLadder returns error for non-afl-api source", async () => {
    const result = await fetchLadder({
      source: "footywire",
      season: 2025,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("only available from the AFL API");
    }
  });
});
