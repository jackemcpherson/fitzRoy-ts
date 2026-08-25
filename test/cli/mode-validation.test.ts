import { describe, expect, it } from "vitest";
import {
  validateAwardsMode,
  validateStatsMode,
  validateTeamMode,
} from "../../src/cli/mode-validation";

describe("validateStatsMode", () => {
  it("rejects summary mode for player statistics", () => {
    expect(() => validateStatsMode({ groupBy: "player", summary: "totals" })).toThrow(
      "--summary is only supported with --by team",
    );
  });

  it.each([{ round: 1 }, { match: "Carlton" }, { matchId: "FW_1" }, { player: "Patrick Cripps" }])(
    "rejects inapplicable team-stat filters %#",
    (flags) => {
      expect(() => validateStatsMode({ groupBy: "team", ...flags })).toThrow(
        "not supported with --by team",
      );
    },
  );

  it("allows a team-row filter with team statistics", () => {
    expect(() => validateStatsMode({ groupBy: "team" })).not.toThrow();
  });

  it("rejects simultaneous match name and identifier filters", () => {
    expect(() =>
      validateStatsMode({ groupBy: "player", match: "Carlton", matchId: "CD_M1" }),
    ).toThrow("Use only one of --match and --id");
  });
});

describe("validateTeamMode", () => {
  it("selects list, squad, and lineup modes from complete flag sets", () => {
    expect(validateTeamMode({})).toBe("list");
    expect(validateTeamMode({ season: 2025, name: "Carlton" })).toBe("squad");
    expect(validateTeamMode({ season: 2025, round: 1 })).toBe("lineup");
  });

  it.each([
    [{ round: 1 }, "--round requires --season"],
    [{ season: 2025 }, "--season requires --name or --team"],
    [{ match: "Carlton" }, "require --season and --round"],
    [{ season: 2025, name: "Carlton", team: "Blues" }, "Use only one of --name and --team"],
    [
      { season: 2025, round: 1, match: "Carlton", matchId: "CD_M1" },
      "Use only one of --match and --match-id",
    ],
  ] as const)("rejects invalid team modes %#", (flags, message) => {
    expect(() => validateTeamMode(flags)).toThrow(message);
  });
});

describe("validateAwardsMode", () => {
  it("rejects a round for non-coaches awards", () => {
    expect(() => validateAwardsMode("brownlow", 1)).toThrow("--round is not supported");
  });

  it("accepts a coaches round", () => {
    expect(() => validateAwardsMode("coaches", 1)).not.toThrow();
  });
});
