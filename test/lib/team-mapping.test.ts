import { describe, expect, it } from "vitest";
import { normaliseTeamName } from "../../src/lib/team-mapping";

describe("normaliseTeamName", () => {
  it("returns the canonical name for a known team", () => {
    expect(normaliseTeamName("Adelaide")).toBe("Adelaide");
  });

  it("handles case-insensitive lookups", () => {
    expect(normaliseTeamName("adelaide")).toBe("Adelaide");
    expect(normaliseTeamName("ADELAIDE")).toBe("Adelaide");
    expect(normaliseTeamName("AdElAiDe")).toBe("Adelaide");
  });

  it("maps abbreviations to canonical names", () => {
    expect(normaliseTeamName("GWS")).toBe("Greater Western Sydney");
    expect(normaliseTeamName("ADEL")).toBe("Adelaide");
    expect(normaliseTeamName("CARL")).toBe("Carlton");
    expect(normaliseTeamName("WCE")).toBe("West Coast");
    expect(normaliseTeamName("STK")).toBe("St Kilda");
    expect(normaliseTeamName("GCFC")).toBe("Gold Coast");
    expect(normaliseTeamName("NMFC")).toBe("North Melbourne");
  });

  it("maps full names with mascots to canonical names", () => {
    expect(normaliseTeamName("Adelaide Crows")).toBe("Adelaide");
    expect(normaliseTeamName("Collingwood Magpies")).toBe("Collingwood");
    expect(normaliseTeamName("Sydney Swans")).toBe("Sydney");
    expect(normaliseTeamName("Greater Western Sydney Giants")).toBe("Greater Western Sydney");
    expect(normaliseTeamName("West Coast Eagles")).toBe("West Coast");
    expect(normaliseTeamName("Gold Coast Suns")).toBe("Gold Coast");
  });

  it("maps mascot-only names to canonical names", () => {
    expect(normaliseTeamName("Crows")).toBe("Adelaide");
    expect(normaliseTeamName("Blues")).toBe("Carlton");
    expect(normaliseTeamName("Magpies")).toBe("Collingwood");
    expect(normaliseTeamName("Bombers")).toBe("Essendon");
    expect(normaliseTeamName("Dockers")).toBe("Fremantle");
    expect(normaliseTeamName("Cats")).toBe("Geelong");
    expect(normaliseTeamName("Suns")).toBe("Gold Coast");
    expect(normaliseTeamName("Giants")).toBe("Greater Western Sydney");
    expect(normaliseTeamName("Hawks")).toBe("Hawthorn");
    expect(normaliseTeamName("Demons")).toBe("Melbourne");
    expect(normaliseTeamName("Kangaroos")).toBe("North Melbourne");
    expect(normaliseTeamName("Power")).toBe("Port Adelaide");
    expect(normaliseTeamName("Tigers")).toBe("Richmond");
    expect(normaliseTeamName("Saints")).toBe("St Kilda");
    expect(normaliseTeamName("Swans")).toBe("Sydney");
    expect(normaliseTeamName("Eagles")).toBe("West Coast");
    expect(normaliseTeamName("Bulldogs")).toBe("Western Bulldogs");
  });

  it("maps historical names to current canonical names", () => {
    expect(normaliseTeamName("Footscray")).toBe("Western Bulldogs");
    expect(normaliseTeamName("Footscray Bulldogs")).toBe("Western Bulldogs");
    expect(normaliseTeamName("South Melbourne")).toBe("Sydney");
    expect(normaliseTeamName("South Melbourne Swans")).toBe("Sydney");
    expect(normaliseTeamName("Brisbane Bears")).toBe("Brisbane Lions");
  });

  it("maps historical names case-insensitively", () => {
    expect(normaliseTeamName("footscray")).toBe("Western Bulldogs");
    expect(normaliseTeamName("SOUTH MELBOURNE")).toBe("Sydney");
  });

  it("handles defunct VFL teams", () => {
    expect(normaliseTeamName("Fitzroy")).toBe("Fitzroy");
    expect(normaliseTeamName("University")).toBe("University");
  });

  it("returns the trimmed input for unknown team names", () => {
    expect(normaliseTeamName("Unknown FC")).toBe("Unknown FC");
    expect(normaliseTeamName("Not A Team")).toBe("Not A Team");
  });

  it("trims whitespace from input", () => {
    expect(normaliseTeamName("  Carlton  ")).toBe("Carlton");
    expect(normaliseTeamName("\tGWS\n")).toBe("Greater Western Sydney");
  });

  it("handles all current AFL teams", () => {
    const allTeams = [
      "Adelaide",
      "Brisbane Lions",
      "Carlton",
      "Collingwood",
      "Essendon",
      "Fremantle",
      "Geelong",
      "Gold Coast",
      "Greater Western Sydney",
      "Hawthorn",
      "Melbourne",
      "North Melbourne",
      "Port Adelaide",
      "Richmond",
      "St Kilda",
      "Sydney",
      "West Coast",
      "Western Bulldogs",
    ];
    for (const team of allTeams) {
      expect(normaliseTeamName(team)).toBe(team);
    }
  });

  it("maps short abbreviations correctly", () => {
    expect(normaliseTeamName("AD")).toBe("Adelaide");
    expect(normaliseTeamName("BL")).toBe("Brisbane Lions");
    expect(normaliseTeamName("CA")).toBe("Carlton");
    expect(normaliseTeamName("CW")).toBe("Collingwood");
    expect(normaliseTeamName("ES")).toBe("Essendon");
    expect(normaliseTeamName("FR")).toBe("Fremantle");
    expect(normaliseTeamName("GE")).toBe("Geelong");
    expect(normaliseTeamName("GC")).toBe("Gold Coast");
    expect(normaliseTeamName("GW")).toBe("Greater Western Sydney");
    expect(normaliseTeamName("HW")).toBe("Hawthorn");
    expect(normaliseTeamName("ME")).toBe("Melbourne");
    expect(normaliseTeamName("NM")).toBe("North Melbourne");
    expect(normaliseTeamName("PA")).toBe("Port Adelaide");
    expect(normaliseTeamName("RI")).toBe("Richmond");
    expect(normaliseTeamName("SK")).toBe("St Kilda");
    expect(normaliseTeamName("SY")).toBe("Sydney");
    expect(normaliseTeamName("WC")).toBe("West Coast");
    expect(normaliseTeamName("WB")).toBe("Western Bulldogs");
  });

  it("handles alternate North Melbourne names", () => {
    expect(normaliseTeamName("Kangas")).toBe("North Melbourne");
    expect(normaliseTeamName("North")).toBe("North Melbourne");
    expect(normaliseTeamName("North Melbourne Kangaroos")).toBe("North Melbourne");
  });

  it("handles Saint Kilda variant", () => {
    expect(normaliseTeamName("Saint Kilda")).toBe("St Kilda");
  });

  it("handles Port Adelaide short form", () => {
    expect(normaliseTeamName("Port")).toBe("Port Adelaide");
    expect(normaliseTeamName("PAFC")).toBe("Port Adelaide");
  });
});
