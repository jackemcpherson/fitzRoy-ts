import { describe, expect, it } from "vitest";
import { normaliseTeamName } from "../../src/lib/team-mapping";

describe("normaliseTeamName", () => {
  it("returns the canonical name for a known team", () => {
    expect(normaliseTeamName("Adelaide Crows")).toBe("Adelaide Crows");
  });

  it("handles case-insensitive lookups", () => {
    expect(normaliseTeamName("adelaide crows")).toBe("Adelaide Crows");
    expect(normaliseTeamName("ADELAIDE CROWS")).toBe("Adelaide Crows");
    expect(normaliseTeamName("adelaide")).toBe("Adelaide Crows");
  });

  it("maps abbreviations to canonical names", () => {
    expect(normaliseTeamName("GWS")).toBe("GWS Giants");
    expect(normaliseTeamName("ADEL")).toBe("Adelaide Crows");
    expect(normaliseTeamName("CARL")).toBe("Carlton");
    expect(normaliseTeamName("WCE")).toBe("West Coast Eagles");
    expect(normaliseTeamName("STK")).toBe("St Kilda");
    expect(normaliseTeamName("GCFC")).toBe("Gold Coast Suns");
    expect(normaliseTeamName("NMFC")).toBe("North Melbourne");
  });

  it("maps short names to canonical AFL API names", () => {
    expect(normaliseTeamName("Adelaide")).toBe("Adelaide Crows");
    expect(normaliseTeamName("Geelong")).toBe("Geelong Cats");
    expect(normaliseTeamName("Sydney")).toBe("Sydney Swans");
    expect(normaliseTeamName("Gold Coast")).toBe("Gold Coast Suns");
    expect(normaliseTeamName("West Coast")).toBe("West Coast Eagles");
    expect(normaliseTeamName("Greater Western Sydney")).toBe("GWS Giants");
  });

  it("normalises API all-caps variants", () => {
    expect(normaliseTeamName("GWS GIANTS")).toBe("GWS Giants");
    expect(normaliseTeamName("Gold Coast SUNS")).toBe("Gold Coast Suns");
  });

  it("maps mascot-only names to canonical names", () => {
    expect(normaliseTeamName("Crows")).toBe("Adelaide Crows");
    expect(normaliseTeamName("Blues")).toBe("Carlton");
    expect(normaliseTeamName("Magpies")).toBe("Collingwood");
    expect(normaliseTeamName("Bombers")).toBe("Essendon");
    expect(normaliseTeamName("Dockers")).toBe("Fremantle");
    expect(normaliseTeamName("Cats")).toBe("Geelong Cats");
    expect(normaliseTeamName("Suns")).toBe("Gold Coast Suns");
    expect(normaliseTeamName("Giants")).toBe("GWS Giants");
    expect(normaliseTeamName("Hawks")).toBe("Hawthorn");
    expect(normaliseTeamName("Demons")).toBe("Melbourne");
    expect(normaliseTeamName("Kangaroos")).toBe("North Melbourne");
    expect(normaliseTeamName("Power")).toBe("Port Adelaide");
    expect(normaliseTeamName("Tigers")).toBe("Richmond");
    expect(normaliseTeamName("Saints")).toBe("St Kilda");
    expect(normaliseTeamName("Swans")).toBe("Sydney Swans");
    expect(normaliseTeamName("Eagles")).toBe("West Coast Eagles");
    expect(normaliseTeamName("Bulldogs")).toBe("Western Bulldogs");
  });

  it("maps historical names to current canonical names", () => {
    expect(normaliseTeamName("Footscray")).toBe("Western Bulldogs");
    expect(normaliseTeamName("Footscray Bulldogs")).toBe("Western Bulldogs");
    expect(normaliseTeamName("South Melbourne")).toBe("Sydney Swans");
    expect(normaliseTeamName("South Melbourne Swans")).toBe("Sydney Swans");
    expect(normaliseTeamName("Brisbane Bears")).toBe("Brisbane Lions");
  });

  it("maps historical names case-insensitively", () => {
    expect(normaliseTeamName("footscray")).toBe("Western Bulldogs");
    expect(normaliseTeamName("SOUTH MELBOURNE")).toBe("Sydney Swans");
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
    expect(normaliseTeamName("\tGWS\n")).toBe("GWS Giants");
  });

  it("handles all current AFL teams by canonical name", () => {
    const allTeams = [
      "Adelaide Crows",
      "Brisbane Lions",
      "Carlton",
      "Collingwood",
      "Essendon",
      "Fremantle",
      "Geelong Cats",
      "Gold Coast Suns",
      "GWS Giants",
      "Hawthorn",
      "Melbourne",
      "North Melbourne",
      "Port Adelaide",
      "Richmond",
      "St Kilda",
      "Sydney Swans",
      "West Coast Eagles",
      "Western Bulldogs",
    ];
    for (const team of allTeams) {
      expect(normaliseTeamName(team)).toBe(team);
    }
  });

  it("maps short abbreviations correctly", () => {
    expect(normaliseTeamName("AD")).toBe("Adelaide Crows");
    expect(normaliseTeamName("BL")).toBe("Brisbane Lions");
    expect(normaliseTeamName("CA")).toBe("Carlton");
    expect(normaliseTeamName("CW")).toBe("Collingwood");
    expect(normaliseTeamName("ES")).toBe("Essendon");
    expect(normaliseTeamName("FR")).toBe("Fremantle");
    expect(normaliseTeamName("GE")).toBe("Geelong Cats");
    expect(normaliseTeamName("GC")).toBe("Gold Coast Suns");
    expect(normaliseTeamName("GW")).toBe("GWS Giants");
    expect(normaliseTeamName("HW")).toBe("Hawthorn");
    expect(normaliseTeamName("ME")).toBe("Melbourne");
    expect(normaliseTeamName("NM")).toBe("North Melbourne");
    expect(normaliseTeamName("PA")).toBe("Port Adelaide");
    expect(normaliseTeamName("RI")).toBe("Richmond");
    expect(normaliseTeamName("SK")).toBe("St Kilda");
    expect(normaliseTeamName("SY")).toBe("Sydney Swans");
    expect(normaliseTeamName("WC")).toBe("West Coast Eagles");
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
