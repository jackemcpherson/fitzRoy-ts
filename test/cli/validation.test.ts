import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  resolveDefaultSeason,
  resolveTeamIdentifier,
  validateCompetition,
  validateFormat,
  validateMatchId,
  validateOptionalCompetition,
  validateOptionalSeason,
  validateRound,
  validateSeason,
  validateSource,
} from "../../src/cli/validation";
import { failureMessage } from "./validated";

describe("validateSeason", () => {
  it("parses valid season year", () => {
    expect(Result.getOrThrow(validateSeason("2025"))).toBe(2025);
    expect(Result.getOrThrow(validateSeason("1897"))).toBe(1897);
  });

  it("rejects non-numeric input", () => {
    expect(failureMessage(validateSeason("abc"))).toContain("Invalid season");
    expect(failureMessage(validateSeason(""))).toContain("Invalid season");
  });

  it("rejects out of range", () => {
    expect(failureMessage(validateSeason("1800"))).toContain("must be between 1897 and 2100");
  });
});

describe("validateRound", () => {
  it("parses valid round numbers", () => {
    expect(Result.getOrThrow(validateRound("1"))).toBe(1);
    expect(Result.getOrThrow(validateRound("27"))).toBe(27);
    expect(Result.getOrThrow(validateRound("0"))).toBe(0);
  });

  it("rejects non-numeric input", () => {
    expect(failureMessage(validateRound("abc"))).toContain("Invalid round");
  });

  it("rejects negative numbers", () => {
    expect(failureMessage(validateRound("-1"))).toContain("Invalid round");
  });
});

describe("validateFormat", () => {
  it("accepts valid formats", () => {
    expect(Result.getOrThrow(validateFormat("table"))).toBe("table");
    expect(Result.getOrThrow(validateFormat("json"))).toBe("json");
    expect(Result.getOrThrow(validateFormat("csv"))).toBe("csv");
  });

  it("is case-insensitive", () => {
    expect(Result.getOrThrow(validateFormat("JSON"))).toBe("json");
    expect(Result.getOrThrow(validateFormat("Table"))).toBe("table");
  });

  it("returns undefined when not provided", () => {
    expect(Result.getOrThrow(validateFormat(undefined))).toBeUndefined();
  });

  it("rejects invalid format", () => {
    expect(failureMessage(validateFormat("xml"))).toContain("Invalid format");
    expect(failureMessage(validateFormat("invalid"))).toContain(
      "valid formats are: table, json, csv",
    );
  });
});

describe("validateCompetition", () => {
  it("accepts valid competition codes", () => {
    expect(Result.getOrThrow(validateCompetition("AFLM"))).toBe("AFLM");
    expect(Result.getOrThrow(validateCompetition("AFLW"))).toBe("AFLW");
  });

  it("is case-insensitive", () => {
    expect(Result.getOrThrow(validateCompetition("aflm"))).toBe("AFLM");
    expect(Result.getOrThrow(validateCompetition("aflw"))).toBe("AFLW");
  });

  it("rejects invalid competition", () => {
    expect(failureMessage(validateCompetition("INVALID"))).toContain("Invalid competition");
    expect(failureMessage(validateCompetition("AFL"))).toContain("valid values are: AFLM, AFLW");
  });
});

describe("validateOptionalCompetition", () => {
  it("returns undefined when not provided", () => {
    expect(Result.getOrThrow(validateOptionalCompetition(undefined))).toBeUndefined();
  });

  it("validates when provided", () => {
    expect(Result.getOrThrow(validateOptionalCompetition("AFLM"))).toBe("AFLM");
    expect(failureMessage(validateOptionalCompetition("INVALID"))).toContain("Invalid competition");
  });
});

describe("validateSource", () => {
  it("accepts valid sources", () => {
    expect(Result.getOrThrow(validateSource("afl-api"))).toBe("afl-api");
    expect(Result.getOrThrow(validateSource("footywire"))).toBe("footywire");
    expect(Result.getOrThrow(validateSource("afl-tables"))).toBe("afl-tables");
    expect(Result.getOrThrow(validateSource("squiggle"))).toBe("squiggle");
    expect(Result.getOrThrow(validateSource("fryzigg"))).toBe("fryzigg");
  });

  it("rejects invalid source", () => {
    expect(failureMessage(validateSource("invalid"))).toContain("Invalid source");
  });
});

describe("validateMatchId", () => {
  it.each([
    ["afl-api", "CD_M20250140101"],
    ["footywire", "FW_11193"],
    ["footywire", "FW_SYNTH_2025_R5_G1"],
    ["afl-tables", "AT_111620240307"],
    ["afl-tables", "AT_SYNTH_2024_1"],
    ["squiggle", "SQ_12345"],
    ["fryzigg", "10001"],
  ] as const)("accepts %s identifier %s", (source, matchId) => {
    expect(Result.getOrThrow(validateMatchId(source, matchId))).toBe(matchId);
  });

  it.each([
    ["afl-api", "FW_11193"],
    ["footywire", "CD_M20250140101"],
    ["afl-tables", "111620240307"],
    ["squiggle", "SQ_bad"],
    ["fryzigg", "FW_11193"],
  ] as const)("rejects %s identifier %s", (source, matchId) => {
    expect(failureMessage(validateMatchId(source, matchId))).toContain(
      `Invalid match ID "${matchId}"`,
    );
  });
});

describe("validateOptionalSeason", () => {
  it("returns undefined when not provided", () => {
    expect(Result.getOrThrow(validateOptionalSeason(undefined))).toBeUndefined();
  });

  it("validates when provided", () => {
    expect(Result.getOrThrow(validateOptionalSeason("2025"))).toBe(2025);
    expect(failureMessage(validateOptionalSeason("abc"))).toContain("Invalid season");
  });
});

describe("resolveDefaultSeason", () => {
  // These assert the clock-based offline fallback only; the authoritative
  // data-driven path is tested in test/sources/afl-api.test.ts.
  it("returns current year for AFLM", () => {
    const year = new Date().getFullYear();
    expect(resolveDefaultSeason("AFLM")).toBe(year);
  });

  it("returns previous year for AFLW", () => {
    const year = new Date().getFullYear();
    expect(resolveDefaultSeason("AFLW")).toBe(year - 1);
  });
});

describe("resolveTeamIdentifier", () => {
  const teams = [
    { teamId: "5", name: "Carlton", abbreviation: "CARL" },
    { teamId: "10", name: "Richmond", abbreviation: "RICH" },
    { teamId: "15", name: "GWS Giants", abbreviation: "GWS" },
  ];

  it("returns numeric ID as-is", () => {
    expect(Result.getOrThrow(resolveTeamIdentifier("5", teams))).toBe("5");
    expect(Result.getOrThrow(resolveTeamIdentifier("10", teams))).toBe("10");
  });

  it("resolves by name (case-insensitive)", () => {
    expect(Result.getOrThrow(resolveTeamIdentifier("Carlton", teams))).toBe("5");
    expect(Result.getOrThrow(resolveTeamIdentifier("carlton", teams))).toBe("5");
  });

  it("resolves by abbreviation (case-insensitive)", () => {
    expect(Result.getOrThrow(resolveTeamIdentifier("CARL", teams))).toBe("5");
    expect(Result.getOrThrow(resolveTeamIdentifier("rich", teams))).toBe("10");
  });

  it("resolves by partial name match", () => {
    expect(Result.getOrThrow(resolveTeamIdentifier("GWS", teams))).toBe("15");
  });

  it("rejects unknown team", () => {
    expect(failureMessage(resolveTeamIdentifier("Unknown FC", teams))).toContain("Unknown team");
  });
});
