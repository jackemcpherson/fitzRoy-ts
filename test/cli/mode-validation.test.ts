import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  validateAwardsMode,
  validateStatsMode,
  validateTeamMode,
} from "../../src/cli/mode-validation";
import { failureMessage } from "./validated";

describe("validateStatsMode", () => {
  it("rejects summary mode for player statistics", () => {
    expect(failureMessage(validateStatsMode({ groupBy: "player", summary: "totals" }))).toContain(
      "--summary is only supported with --by team",
    );
  });

  it.each([{ round: 1 }, { match: "Carlton" }, { matchId: "FW_1" }, { player: "Patrick Cripps" }])(
    "rejects inapplicable team-stat filters %#",
    (flags) => {
      expect(failureMessage(validateStatsMode({ groupBy: "team", ...flags }))).toContain(
        "not supported with --by team",
      );
    },
  );

  it("allows a team-row filter with team statistics", () => {
    expect(Result.isSuccess(validateStatsMode({ groupBy: "team" }))).toBe(true);
  });

  it("rejects simultaneous match name and identifier filters", () => {
    expect(
      failureMessage(validateStatsMode({ groupBy: "player", match: "Carlton", matchId: "CD_M1" })),
    ).toContain("Use only one of --match and --id");
  });
});

describe("validateTeamMode", () => {
  it("selects list, squad, and lineup modes from complete flag sets", () => {
    expect(Result.getOrThrow(validateTeamMode({}))).toBe("list");
    expect(Result.getOrThrow(validateTeamMode({ season: 2025, name: "Carlton" }))).toBe("squad");
    expect(Result.getOrThrow(validateTeamMode({ season: 2025, round: 1 }))).toBe("lineup");
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
    expect(failureMessage(validateTeamMode(flags))).toContain(message);
  });
});

describe("validateAwardsMode", () => {
  it("rejects a round for non-coaches awards", () => {
    expect(failureMessage(validateAwardsMode("brownlow", 1))).toContain("--round is not supported");
  });

  it("accepts a coaches round", () => {
    expect(Result.isSuccess(validateAwardsMode("coaches", 1))).toBe(true);
  });
});
