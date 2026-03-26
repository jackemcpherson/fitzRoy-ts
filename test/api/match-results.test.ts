import { describe, expect, it } from "vitest";
import { fetchLadder } from "../../src/api/ladder";
import { fetchLineup } from "../../src/api/lineup";

describe("public API source validation", () => {
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

  it("fetchLadder returns error for footywire source", async () => {
    const result = await fetchLadder({
      source: "footywire",
      season: 2025,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("only available from the AFL API");
    }
  });

  it("fetchLineup returns error for squiggle source", async () => {
    const result = await fetchLineup({
      source: "squiggle",
      season: 2025,
      round: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("only available from the AFL API");
    }
  });
});
