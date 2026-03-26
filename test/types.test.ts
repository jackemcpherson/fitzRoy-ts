import { describe, expect, it } from "vitest";
import type {
  CompetitionCode,
  DataSource,
  Fixture,
  Ladder,
  LadderEntry,
  LadderQuery,
  Lineup,
  LineupPlayer,
  LineupQuery,
  MatchQuery,
  MatchResult,
  MatchStatus,
  PlayerStats,
  PlayerStatsQuery,
  QuarterScore,
  RoundType,
  SeasonRoundQuery,
  Squad,
  SquadPlayer,
  SquadQuery,
  Team,
  TeamQuery,
} from "../src/types";

// Compile-time type smoke tests — these verify that domain type shapes
// remain constructible. The runtime assertions are intentionally minimal;
// the real value is that the file fails to compile if a type changes.
describe("domain types", () => {
  it("CompetitionCode accepts valid values", () => {
    const codes: CompetitionCode[] = ["AFLM", "AFLW"];
    expect(codes).toHaveLength(2);
  });

  it("DataSource accepts valid values", () => {
    const sources: DataSource[] = ["afl-api", "footywire", "afl-tables"];
    expect(sources).toHaveLength(3);
  });

  it("RoundType accepts valid values", () => {
    const types: RoundType[] = ["HomeAndAway", "Finals"];
    expect(types).toHaveLength(2);
  });

  it("MatchStatus accepts valid values", () => {
    const statuses: MatchStatus[] = ["Upcoming", "Live", "Complete", "Postponed", "Cancelled"];
    expect(statuses).toHaveLength(5);
  });

  it("MatchResult shape is constructible with all required fields", () => {
    const quarter: QuarterScore = { goals: 3, behinds: 2, points: 20 };
    const match: MatchResult = {
      matchId: "CD_M20260140101",
      season: 2026,
      roundNumber: 1,
      roundType: "HomeAndAway",
      date: new Date("2026-03-20T19:10:00+11:00"),
      venue: "MCG",
      homeTeam: "Richmond",
      awayTeam: "Carlton",
      homeGoals: 12,
      homeBehinds: 8,
      homePoints: 80,
      awayGoals: 15,
      awayBehinds: 10,
      awayPoints: 100,
      margin: -20,
      q1Home: quarter,
      q2Home: quarter,
      q3Home: quarter,
      q4Home: quarter,
      q1Away: quarter,
      q2Away: quarter,
      q3Away: quarter,
      q4Away: quarter,
      status: "Complete",
      attendance: 85000,
      source: "afl-api",
      competition: "AFLM",
    };
    expect(match.homeTeam).toBe("Richmond");
    expect(match.q1Home).toEqual(quarter);
  });

  it("MatchResult allows null quarter scores", () => {
    const match: MatchResult = {
      matchId: "CD_M20260140101",
      season: 2026,
      roundNumber: 1,
      roundType: "HomeAndAway",
      date: new Date("2026-03-20"),
      venue: "MCG",
      homeTeam: "Richmond",
      awayTeam: "Carlton",
      homeGoals: 12,
      homeBehinds: 8,
      homePoints: 80,
      awayGoals: 15,
      awayBehinds: 10,
      awayPoints: 100,
      margin: -20,
      q1Home: null,
      q2Home: null,
      q3Home: null,
      q4Home: null,
      q1Away: null,
      q2Away: null,
      q3Away: null,
      q4Away: null,
      status: "Complete",
      attendance: null,
      source: "afl-tables",
      competition: "AFLM",
    };
    expect(match.q1Home).toBeNull();
    expect(match.attendance).toBeNull();
  });

  it("PlayerStats shape is constructible with nullable stat fields", () => {
    const stats: PlayerStats = {
      matchId: "CD_M20260140101",
      season: 2026,
      roundNumber: 1,
      team: "Richmond",
      competition: "AFLM",
      playerId: "CD_I123456",
      givenName: "Dustin",
      surname: "Martin",
      displayName: "D. Martin",
      jumperNumber: 4,
      kicks: 20,
      handballs: 10,
      disposals: 30,
      marks: 5,
      goals: 2,
      behinds: 1,
      tackles: 4,
      hitouts: null,
      freesFor: 3,
      freesAgainst: 1,
      contestedPossessions: 12,
      uncontestedPossessions: 18,
      contestedMarks: 1,
      intercepts: 2,
      centreClearances: 3,
      stoppageClearances: 4,
      totalClearances: 7,
      inside50s: 5,
      rebound50s: 2,
      clangers: 3,
      turnovers: 4,
      onePercenters: 1,
      bounces: 0,
      goalAssists: 1,
      disposalEfficiency: 73.3,
      metresGained: 450,
      dreamTeamPoints: 120,
      supercoachPoints: 115,
      brownlowVotes: null,
      source: "afl-api",
    };
    expect(stats.disposals).toBe(30);
    expect(stats.hitouts).toBeNull();
  });

  it("Fixture shape is constructible", () => {
    const fixture: Fixture = {
      matchId: "CD_M20260140102",
      season: 2026,
      roundNumber: 2,
      roundType: "HomeAndAway",
      date: new Date("2026-03-27T19:50:00+11:00"),
      venue: "Docklands",
      homeTeam: "Essendon",
      awayTeam: "Collingwood",
      status: "Upcoming",
      competition: "AFLM",
    };
    expect(fixture.status).toBe("Upcoming");
  });

  it("Lineup shape supports emergency and substitute flags", () => {
    const player: LineupPlayer = {
      playerId: "CD_I999",
      givenName: "Test",
      surname: "Player",
      displayName: "T. Player",
      jumperNumber: 99,
      position: "Ruck",
      isEmergency: false,
      isSubstitute: true,
    };
    const lineup: Lineup = {
      matchId: "CD_M20260140101",
      season: 2026,
      roundNumber: 1,
      homeTeam: "Richmond",
      awayTeam: "Carlton",
      homePlayers: [player],
      awayPlayers: [],
      competition: "AFLM",
    };
    expect(lineup.homePlayers[0]?.isSubstitute).toBe(true);
  });

  it("Ladder shape contains entries with all standing fields", () => {
    const entry: LadderEntry = {
      position: 1,
      team: "Geelong",
      played: 10,
      wins: 8,
      losses: 1,
      draws: 1,
      pointsFor: 1200,
      pointsAgainst: 900,
      percentage: 133.3,
      premiershipsPoints: 34,
    };
    const ladder: Ladder = {
      season: 2026,
      roundNumber: 10,
      entries: [entry],
      competition: "AFLM",
    };
    expect(ladder.entries[0]?.percentage).toBe(133.3);
  });

  it("Team and Squad shapes are constructible", () => {
    const team: Team = {
      teamId: "CD_T10",
      name: "Geelong Cats",
      abbreviation: "GEEL",
      competition: "AFLM",
    };
    const squadPlayer: SquadPlayer = {
      playerId: "CD_I555",
      givenName: "Patrick",
      surname: "Dangerfield",
      displayName: "P. Dangerfield",
      jumperNumber: 35,
      position: "Midfielder",
      dateOfBirth: new Date("1990-04-05"),
      heightCm: 189,
      weightKg: 92,
    };
    const squad: Squad = {
      teamId: "CD_T10",
      teamName: "Geelong Cats",
      season: 2026,
      players: [squadPlayer],
      competition: "AFLM",
    };
    expect(team.abbreviation).toBe("GEEL");
    expect(squad.players[0]?.surname).toBe("Dangerfield");
  });

  it("SeasonRoundQuery supports optional fields", () => {
    const query: SeasonRoundQuery = {
      source: "afl-api",
      season: 2026,
    };
    expect(query.round).toBeUndefined();
    expect(query.competition).toBeUndefined();
  });

  it("MatchQuery requires matchId", () => {
    const query: MatchQuery = {
      source: "afl-api",
      matchId: "CD_M20260140101",
    };
    expect(query.matchId).toBe("CD_M20260140101");
  });

  it("PlayerStatsQuery supports season/round and matchId modes", () => {
    const byRound: PlayerStatsQuery = {
      source: "afl-api",
      season: 2026,
      round: 1,
    };
    const byMatch: PlayerStatsQuery = {
      source: "afl-api",
      season: 2026,
      matchId: "CD_M20260140101",
    };
    expect(byRound.round).toBe(1);
    expect(byMatch.matchId).toBe("CD_M20260140101");
  });

  it("LadderQuery, TeamQuery, and SquadQuery are constructible", () => {
    const ladderQuery: LadderQuery = {
      source: "afl-api",
      season: 2026,
      round: 10,
      competition: "AFLM",
    };
    const teamQuery: TeamQuery = { competition: "AFLW" };
    const squadQuery: SquadQuery = { teamId: "CD_T10", season: 2026 };
    expect(ladderQuery.round).toBe(10);
    expect(teamQuery.competition).toBe("AFLW");
    expect(squadQuery.teamId).toBe("CD_T10");
  });

  it("LineupQuery requires round number", () => {
    const query: LineupQuery = {
      source: "afl-api",
      season: 2026,
      round: 1,
    };
    expect(query.round).toBe(1);
  });
});
