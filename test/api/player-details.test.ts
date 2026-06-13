// TODO(plan #7): no afl-api-player-details / afl-api-squad fixture
// captured; add a happy-path test once a squad-endpoint snapshot is
// available (fetchPlayerDetails is a denormalised view over fetchSquad).

import { describe, expect, it } from "vitest";
import { fetchPlayerDetails } from "../../src/api/player-details";

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
