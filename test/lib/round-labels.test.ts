import { describe, expect, it } from "vitest";
import { roundAbbreviation, roundLabel, roundTypeLabel } from "../../src/lib/round-labels";

describe("roundLabel", () => {
  it("returns the raw roundName unchanged when provided", () => {
    expect(roundLabel(1, "Round 1", "HomeAndAway")).toBe("Round 1");
    expect(roundLabel(4, "Grand Final", "Finals")).toBe("Grand Final");
    expect(roundLabel(0, "Opening Round", "HomeAndAway")).toBe("Opening Round");
  });

  it("synthesises Opening Round when roundNumber is 0 and roundName is null", () => {
    expect(roundLabel(0, null, "HomeAndAway")).toBe("Opening Round");
  });

  it("synthesises Round N for home-and-away rounds when roundName is null", () => {
    expect(roundLabel(1, null, "HomeAndAway")).toBe("Round 1");
    expect(roundLabel(23, null, "HomeAndAway")).toBe("Round 23");
  });

  it("synthesises Finals N for finals rounds when roundName is null", () => {
    expect(roundLabel(1, null, "Finals")).toBe("Finals 1");
    expect(roundLabel(4, null, "Finals")).toBe("Finals 4");
  });
});

describe("roundAbbreviation", () => {
  it("maps Opening Round to OR when roundName is provided", () => {
    expect(roundAbbreviation(0, "Opening Round", "HomeAndAway")).toBe("OR");
  });

  it("maps Wildcard to WC", () => {
    expect(roundAbbreviation(1, "Wildcard", "Finals")).toBe("WC");
  });

  it("maps named finals rounds to standard codes", () => {
    expect(roundAbbreviation(1, "Qualifying Finals", "Finals")).toBe("QF");
    expect(roundAbbreviation(1, "Elimination Finals", "Finals")).toBe("EF");
    expect(roundAbbreviation(2, "Semi Finals", "Finals")).toBe("SF");
    expect(roundAbbreviation(3, "Preliminary Finals", "Finals")).toBe("PF");
    expect(roundAbbreviation(4, "Grand Final", "Finals")).toBe("GF");
  });

  it("maps Finals Week N labels", () => {
    expect(roundAbbreviation(1, "Finals Week 1", "Finals")).toBe("FW1");
    expect(roundAbbreviation(2, "Finals Week 2", "Finals")).toBe("FW2");
  });

  it("maps Round N to Rd N when roundName follows the pattern", () => {
    expect(roundAbbreviation(1, "Round 1", "HomeAndAway")).toBe("Rd 1");
    expect(roundAbbreviation(23, "Round 23", "HomeAndAway")).toBe("Rd 23");
  });

  it("returns OR when roundNumber is 0 and roundName is null", () => {
    expect(roundAbbreviation(0, null, "HomeAndAway")).toBe("OR");
  });

  it("returns Rd N for home-and-away rounds when roundName is null", () => {
    expect(roundAbbreviation(1, null, "HomeAndAway")).toBe("Rd 1");
    expect(roundAbbreviation(25, null, "HomeAndAway")).toBe("Rd 25");
  });

  it("returns F{N} for finals rounds when roundName is null", () => {
    expect(roundAbbreviation(1, null, "Finals")).toBe("F1");
    expect(roundAbbreviation(4, null, "Finals")).toBe("F4");
  });

  it("falls through to Rd N for unrecognised roundName on home-and-away", () => {
    expect(roundAbbreviation(5, "Unknown Round Label", "HomeAndAway")).toBe("Rd 5");
  });

  it("falls through to F{N} for unrecognised roundName on finals", () => {
    expect(roundAbbreviation(2, "Some Custom Final", "Finals")).toBe("F2");
  });
});

describe("roundTypeLabel", () => {
  it("returns Regular for HomeAndAway", () => {
    expect(roundTypeLabel("HomeAndAway")).toBe("Regular");
  });

  it("returns Finals for Finals", () => {
    expect(roundTypeLabel("Finals")).toBe("Finals");
  });
});
