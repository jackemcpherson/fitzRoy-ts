// TODO(plan #7): no afl-api-squad-*.json fixture captured; add a happy-path
// test once a squad-endpoint snapshot is available (the squad call also
// resolves a team-id via /teams and a compseason, so the fixture set will
// need to cover those too).

import { describe, expect, it } from "vitest";
import { fetchSquad } from "../../src/api/teams";

describe("fetchSquad public API dispatch", () => {
  it("returns error for unsupported squiggle source", async () => {
    const result = await fetchSquad({
      team: "Carlton",
      season: 2024,
      source: "squiggle",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("squiggle does not provide squad");
    }
  });

  it("returns error for fryzigg source (player-stats only, not squad)", async () => {
    const result = await fetchSquad({
      team: "Carlton",
      season: 2024,
      source: "fryzigg",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("fryzigg does not provide squad");
    }
  });

  it("returns error for season below afl-api coverage (pre-2012)", async () => {
    const result = await fetchSquad({
      team: "Carlton",
      season: 2010,
      source: "afl-api",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("2010");
    }
  });
});
