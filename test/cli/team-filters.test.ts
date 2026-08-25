import { describe, expect, it } from "vitest";
import { filterLineupsByTeam, filterTeamList, flattenLineups } from "../../src/cli/team-filters";
import type { Lineup, LineupPlayer, Team } from "../../src/types";

/** Build a minimal LineupPlayer for tests. */
function makePlayer(
  displayName: string,
  opts: { isEmergency?: boolean; isSubstitute?: boolean } = {},
): LineupPlayer {
  return {
    playerId: `CD_I_${displayName.replace(" ", "_")}`,
    givenName: displayName.split(" ")[0] ?? "Test",
    surname: displayName.split(" ")[1] ?? "Player",
    displayName,
    jumperNumber: null,
    matchPosition: null,
    isEmergency: opts.isEmergency ?? false,
    isSubstitute: opts.isSubstitute ?? false,
  };
}

/** Build a minimal Lineup for tests. */
function makeLineup(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  homePlayers: readonly LineupPlayer[],
  awayPlayers: readonly LineupPlayer[],
): Lineup {
  return {
    matchId,
    season: 2025,
    roundNumber: 1,
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    competition: "AFLM",
    source: "afl-api",
  };
}

/** Build a minimal Team for tests. */
function makeTeam(teamId: string, name: string, abbreviation: string): Team {
  return { teamId, name, abbreviation, competition: "AFLM", source: "afl-api" };
}

describe("flattenLineups", () => {
  it("flattens home and away players to one row each with correct team and matchId", () => {
    const lineup = makeLineup(
      "CD_M20250101001",
      "Richmond",
      "Collingwood",
      [makePlayer("Jack Riewoldt"), makePlayer("Dustin Martin")],
      [makePlayer("Nick Daicos"), makePlayer("Scott Pendlebury")],
    );
    const rows = flattenLineups([lineup]);
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.team === "Richmond")).toHaveLength(2);
    expect(rows.filter((r) => r.team === "Collingwood")).toHaveLength(2);
    expect(rows.every((r) => r.matchId === "CD_M20250101001")).toBe(true);
  });

  it("teamFilter keeps only rows for that side", () => {
    const lineup = makeLineup(
      "CD_M20250101001",
      "Richmond",
      "Collingwood",
      [makePlayer("Jack Riewoldt"), makePlayer("Dustin Martin")],
      [makePlayer("Nick Daicos"), makePlayer("Scott Pendlebury")],
    );
    const rows = flattenLineups([lineup], "Richmond");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.team === "Richmond")).toBe(true);
  });

  it("teamFilter matches lowercase aliases", () => {
    const lineup = makeLineup(
      "CD_M20250101001",
      "Carlton",
      "Richmond",
      [makePlayer("Patrick Cripps")],
      [makePlayer("Tom Lynch")],
    );
    const rows = flattenLineups([lineup], "blues");
    expect(rows.map((row) => row.team)).toEqual(["Carlton"]);
  });

  it("carries isEmergency and isSubstitute flags through to the flattened rows", () => {
    const lineup = makeLineup(
      "CD_M20250101001",
      "Richmond",
      "Collingwood",
      [makePlayer("Jack Riewoldt", { isEmergency: true })],
      [makePlayer("Nick Daicos", { isSubstitute: true })],
    );
    const rows = flattenLineups([lineup]);
    const richmondRow = rows.find((r) => r.team === "Richmond");
    const collingwoodRow = rows.find((r) => r.team === "Collingwood");
    expect(richmondRow?.isEmergency).toBe(true);
    expect(collingwoodRow?.isSubstitute).toBe(true);
  });
});

describe("filterLineupsByTeam", () => {
  it("keeps only lineups where the given team played", () => {
    const lineups = [
      makeLineup("CD_M001", "Richmond", "Collingwood", [], []),
      makeLineup("CD_M002", "Carlton", "Essendon", [], []),
      makeLineup("CD_M003", "Richmond", "Geelong Cats", [], []),
    ];
    const result = filterLineupsByTeam(lineups, "Richmond");
    expect(result).toHaveLength(2);
    expect(result.every((l) => l.homeTeam === "Richmond" || l.awayTeam === "Richmond")).toBe(true);
  });

  it("returns an empty array when no lineups match the team", () => {
    const lineups = [makeLineup("CD_M001", "Carlton", "Essendon", [], [])];
    expect(filterLineupsByTeam(lineups, "Richmond")).toHaveLength(0);
  });

  it("matches lowercase aliases against canonical lineup names", () => {
    const lineups = [makeLineup("CD_M001", "Carlton", "Richmond", [], [])];
    expect(filterLineupsByTeam(lineups, "blues")).toHaveLength(1);
  });
});

describe("filterTeamList", () => {
  const teams = [
    makeTeam("CD_T10", "Richmond", "RIC"),
    makeTeam("CD_T20", "Collingwood", "COL"),
    makeTeam("CD_T30", "Carlton", "CAR"),
  ];

  it("matches by lowercase name", () => {
    const result = filterTeamList(teams, "richmond");
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Richmond");
  });

  it("matches by mixed-case name", () => {
    const result = filterTeamList(teams, "Collingwood");
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Collingwood");
  });

  it("matches by lowercase abbreviation", () => {
    const result = filterTeamList(teams, "ric");
    expect(result).toHaveLength(1);
    expect(result[0]?.abbreviation).toBe("RIC");
  });

  it("matches by exact teamId", () => {
    const result = filterTeamList(teams, "CD_T30");
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Carlton");
  });

  it("retains numeric team-list identifier lookup", () => {
    const numericTeams = [makeTeam("30", "Carlton", "CAR")];
    expect(filterTeamList(numericTeams, "30")).toEqual(numericTeams);
  });

  it("throws with a helpful message listing alternatives when no team matches", () => {
    expect(() => filterTeamList(teams, "Brisbane Lions")).toThrow(
      'No team matched "Brisbane Lions"',
    );
    expect(() => filterTeamList(teams, "Brisbane Lions")).toThrow("Richmond (RIC)");
  });
});
