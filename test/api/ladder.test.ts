// TODO(plan #7): no afl-api compseasons/rounds fixtures captured to drive
// the AflApiLadderSource happy path end-to-end (the existing
// `afl-api-ladder-2024-r10.json` fixture only covers the final /ladders
// response, not the resolveCompSeason and resolveRounds calls that must
// succeed first). Add a happy-path test once those upstream fixtures are
// captured.

import { describe, expect, it } from "vitest";
import { fetchLadder } from "../../src/api/ladder";

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
