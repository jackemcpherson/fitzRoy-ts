import { describe, expect, it } from "vitest";
import {
  resolveDefaultSeason,
  resolveTeamIdentifier,
  validateCompetition,
  validateFormat,
  validateOptionalCompetition,
  validateOptionalSeason,
  validateRound,
  validateSeason,
  validateSource,
} from "../../src/cli/validation";

describe("validateSeason", () => {
  it("parses valid season year", () => {
    expect(validateSeason("2025")).toBe(2025);
    expect(validateSeason("1897")).toBe(1897);
  });

  it("throws for non-numeric input", () => {
    expect(() => validateSeason("abc")).toThrow("Invalid season");
    expect(() => validateSeason("")).toThrow("Invalid season");
  });

  it("throws for out of range", () => {
    expect(() => validateSeason("1800")).toThrow("must be between 1897 and 2100");
  });
});

describe("validateRound", () => {
  it("parses valid round numbers", () => {
    expect(validateRound("1")).toBe(1);
    expect(validateRound("27")).toBe(27);
    expect(validateRound("0")).toBe(0);
  });

  it("throws for non-numeric input", () => {
    expect(() => validateRound("abc")).toThrow("Invalid round");
  });

  it("throws for negative numbers", () => {
    expect(() => validateRound("-1")).toThrow("Invalid round");
  });
});

describe("validateFormat", () => {
  it("accepts valid formats", () => {
    expect(validateFormat("table")).toBe("table");
    expect(validateFormat("json")).toBe("json");
    expect(validateFormat("csv")).toBe("csv");
  });

  it("is case-insensitive", () => {
    expect(validateFormat("JSON")).toBe("json");
    expect(validateFormat("Table")).toBe("table");
  });

  it("returns undefined when not provided", () => {
    expect(validateFormat(undefined)).toBeUndefined();
  });

  it("throws for invalid format", () => {
    expect(() => validateFormat("xml")).toThrow("Invalid format");
    expect(() => validateFormat("invalid")).toThrow("valid formats are: table, json, csv");
  });
});

describe("validateCompetition", () => {
  it("accepts valid competition codes", () => {
    expect(validateCompetition("AFLM")).toBe("AFLM");
    expect(validateCompetition("AFLW")).toBe("AFLW");
  });

  it("is case-insensitive", () => {
    expect(validateCompetition("aflm")).toBe("AFLM");
    expect(validateCompetition("aflw")).toBe("AFLW");
  });

  it("throws for invalid competition", () => {
    expect(() => validateCompetition("INVALID")).toThrow("Invalid competition");
    expect(() => validateCompetition("AFL")).toThrow("valid values are: AFLM, AFLW");
  });
});

describe("validateOptionalCompetition", () => {
  it("returns undefined when not provided", () => {
    expect(validateOptionalCompetition(undefined)).toBeUndefined();
  });

  it("validates when provided", () => {
    expect(validateOptionalCompetition("AFLM")).toBe("AFLM");
    expect(() => validateOptionalCompetition("INVALID")).toThrow("Invalid competition");
  });
});

describe("validateSource", () => {
  it("accepts valid sources", () => {
    expect(validateSource("afl-api")).toBe("afl-api");
    expect(validateSource("footywire")).toBe("footywire");
    expect(validateSource("afl-tables")).toBe("afl-tables");
    expect(validateSource("squiggle")).toBe("squiggle");
  });

  it("throws for invalid source", () => {
    expect(() => validateSource("invalid")).toThrow("Invalid source");
    expect(() => validateSource("fryzigg")).toThrow("valid sources are:");
  });
});

describe("validateOptionalSeason", () => {
  it("returns undefined when not provided", () => {
    expect(validateOptionalSeason(undefined)).toBeUndefined();
  });

  it("validates when provided", () => {
    expect(validateOptionalSeason("2025")).toBe(2025);
    expect(() => validateOptionalSeason("abc")).toThrow("Invalid season");
  });
});

describe("resolveDefaultSeason", () => {
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
    expect(resolveTeamIdentifier("5", teams)).toBe("5");
    expect(resolveTeamIdentifier("10", teams)).toBe("10");
  });

  it("resolves by name (case-insensitive)", () => {
    expect(resolveTeamIdentifier("Carlton", teams)).toBe("5");
    expect(resolveTeamIdentifier("carlton", teams)).toBe("5");
  });

  it("resolves by abbreviation (case-insensitive)", () => {
    expect(resolveTeamIdentifier("CARL", teams)).toBe("5");
    expect(resolveTeamIdentifier("rich", teams)).toBe("10");
  });

  it("resolves by partial name match", () => {
    expect(resolveTeamIdentifier("GWS", teams)).toBe("15");
  });

  it("throws for unknown team", () => {
    expect(() => resolveTeamIdentifier("Unknown FC", teams)).toThrow("Unknown team");
  });
});
