import { describe, expect, it } from "vitest";
import { rankColemanFromStats } from "../../src/api/awards";
import type { PlayerStats } from "../../src/types";

function makeStats(
  playerId: string,
  displayName: string,
  team: string,
  goals: number | null,
  matchId = "M1",
): PlayerStats {
  return {
    matchId,
    season: 2025,
    roundNumber: 1,
    team,
    competition: "AFLM",
    date: null,
    homeTeam: null,
    awayTeam: null,
    playerId,
    givenName: displayName.split(" ")[0] ?? "",
    surname: displayName.split(" ")[1] ?? "",
    displayName,
    jumperNumber: null,
    kicks: null,
    handballs: null,
    disposals: null,
    marks: null,
    goals,
    behinds: null,
    tackles: null,
    hitouts: null,
    freesFor: null,
    freesAgainst: null,
    contestedPossessions: null,
    uncontestedPossessions: null,
    contestedMarks: null,
    intercepts: null,
    centreClearances: null,
    stoppageClearances: null,
    totalClearances: null,
    inside50s: null,
    rebound50s: null,
    clangers: null,
    turnovers: null,
    onePercenters: null,
    bounces: null,
    goalAssists: null,
    disposalEfficiency: null,
    metresGained: null,
    goalAccuracy: null,
    marksInside50: null,
    tacklesInside50: null,
    shotsAtGoal: null,
    scoreInvolvements: null,
    totalPossessions: null,
    timeOnGroundPercentage: null,
    ratingPoints: null,
    position: null,
    goalEfficiency: null,
    shotEfficiency: null,
    interchangeCounts: null,
    brownlowVotes: null,
    supercoachScore: null,
    dreamTeamPoints: null,
    effectiveDisposals: null,
    effectiveKicks: null,
    kickEfficiency: null,
    kickToHandballRatio: null,
    pressureActs: null,
    defHalfPressureActs: null,
    spoils: null,
    hitoutsToAdvantage: null,
    hitoutWinPercentage: null,
    hitoutToAdvantageRate: null,
    groundBallGets: null,
    f50GroundBallGets: null,
    interceptMarks: null,
    marksOnLead: null,
    contestedPossessionRate: null,
    contestOffOneOnOnes: null,
    contestOffWins: null,
    contestOffWinsPercentage: null,
    contestDefOneOnOnes: null,
    contestDefLosses: null,
    contestDefLossPercentage: null,
    centreBounceAttendances: null,
    kickins: null,
    kickinsPlayon: null,
    ruckContests: null,
    scoreLaunches: null,
    source: "afl-api",
  };
}

describe("rankColemanFromStats", () => {
  it("sums goals per player across matches and ranks descending", () => {
    const stats: PlayerStats[] = [
      makeStats("p1", "Charlie Curnow", "Carlton", 4, "M1"),
      makeStats("p1", "Charlie Curnow", "Carlton", 3, "M2"),
      makeStats("p2", "Tom Lynch", "Richmond", 5, "M1"),
      makeStats("p2", "Tom Lynch", "Richmond", 1, "M2"),
      makeStats("p3", "Jeremy Cameron", "Geelong", 2, "M1"),
    ];

    const result = rankColemanFromStats(stats, 2025, "AFLM");

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      type: "coleman",
      season: 2025,
      competition: "AFLM",
      rank: 1,
      player: "Charlie Curnow",
      team: "Carlton",
      goals: 7,
      gamesPlayed: 2,
    });
    expect(result[1]?.player).toBe("Tom Lynch");
    expect(result[1]?.goals).toBe(6);
    expect(result[2]?.player).toBe("Jeremy Cameron");
    expect(result[2]?.goals).toBe(2);
  });

  it("assigns shared positions on ties", () => {
    const stats: PlayerStats[] = [
      makeStats("p1", "Player One", "T1", 5),
      makeStats("p2", "Player Two", "T2", 5),
      makeStats("p3", "Player Three", "T3", 3),
    ];

    const result = rankColemanFromStats(stats, 2025, "AFLM");

    expect(result[0]?.rank).toBe(1);
    expect(result[1]?.rank).toBe(1);
    expect(result[2]?.rank).toBe(3);
  });

  it("excludes players with zero or null goals", () => {
    const stats: PlayerStats[] = [
      makeStats("p1", "Goal Scorer", "T1", 10),
      makeStats("p2", "Defender", "T2", 0),
      makeStats("p3", "Missing Stats", "T3", null),
    ];

    const result = rankColemanFromStats(stats, 2025, "AFLM");

    expect(result).toHaveLength(1);
    expect(result[0]?.player).toBe("Goal Scorer");
  });

  it("respects the limit parameter", () => {
    const stats: PlayerStats[] = [
      makeStats("p1", "First", "T1", 50),
      makeStats("p2", "Second", "T2", 40),
      makeStats("p3", "Third", "T3", 30),
      makeStats("p4", "Fourth", "T4", 20),
    ];

    const result = rankColemanFromStats(stats, 2025, "AFLM", 2);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.player)).toEqual(["First", "Second"]);
  });

  it("returns empty array when no goals are scored", () => {
    const stats: PlayerStats[] = [
      makeStats("p1", "P1", "T1", 0),
      makeStats("p2", "P2", "T2", null),
    ];

    expect(rankColemanFromStats(stats, 2025, "AFLM")).toEqual([]);
  });
});
