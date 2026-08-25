import { describe, expect, it } from "vitest";
import { applyStatsFilters, filterTeamStats } from "../../src/cli/stats-filters";
import type { PlayerStats, TeamStatsEntry } from "../../src/types";

/** Build a minimal PlayerStats object with only the filter-relevant fields set. */
function makeStats(team: string, displayName: string): PlayerStats {
  return {
    matchId: "CD_M20250101001",
    season: 2025,
    roundNumber: 1,
    team,
    competition: "AFLM",
    date: null,
    homeTeam: null,
    awayTeam: null,
    playerId: "CD_I12345",
    givenName: "Test",
    surname: "Player",
    displayName,
    jumperNumber: null,
    kicks: null,
    handballs: null,
    disposals: null,
    marks: null,
    goals: null,
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

describe("applyStatsFilters", () => {
  it("returns input unchanged when no options are supplied", () => {
    const stats = [
      makeStats("Richmond", "Jack Riewoldt"),
      makeStats("Collingwood", "Nick Daicos"),
      makeStats("Carlton", "Charlie Curnow"),
    ];
    const result = applyStatsFilters(stats, {});
    expect(result).toEqual(stats);
  });

  it("participants filter keeps only rows whose team is home or away", () => {
    const stats = [
      makeStats("Richmond", "Jack Riewoldt"),
      makeStats("Collingwood", "Nick Daicos"),
      makeStats("Carlton", "Charlie Curnow"),
    ];
    const result = applyStatsFilters(stats, {
      participants: { homeTeam: "Richmond", awayTeam: "Collingwood" },
    });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.team)).toEqual(["Richmond", "Collingwood"]);
  });

  it("participants filter compares aliases and case canonically", () => {
    const stats = [makeStats("Carlton", "Patrick Cripps"), makeStats("Richmond", "Tom Lynch")];
    const result = applyStatsFilters(stats, {
      participants: { homeTeam: "blues", awayTeam: "RICHMOND" },
    });
    expect(result).toHaveLength(2);
  });

  it("team filter composes after participants — row in the match but wrong team is excluded", () => {
    const stats = [makeStats("Richmond", "Jack Riewoldt"), makeStats("Collingwood", "Nick Daicos")];
    const result = applyStatsFilters(stats, {
      participants: { homeTeam: "Richmond", awayTeam: "Collingwood" },
      team: "Richmond",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.team).toBe("Richmond");
  });

  it("player fuzzy filter matches an exact name", () => {
    const stats = [makeStats("Richmond", "Jack Riewoldt"), makeStats("Collingwood", "Nick Daicos")];
    const result = applyStatsFilters(stats, { player: "Jack Riewoldt" });
    expect(result).toHaveLength(1);
    expect(result[0]?.displayName).toBe("Jack Riewoldt");
  });

  it("player fuzzy filter matches a near-miss within the 0.4 threshold", () => {
    // "Tom Linch" → "Tom Lynch": 1 edit, max length 9, normalised ≈ 0.11 ≤ 0.4
    const stats = [makeStats("Richmond", "Tom Lynch"), makeStats("Collingwood", "Nick Daicos")];
    const result = applyStatsFilters(stats, { player: "Tom Linch" });
    expect(result).toHaveLength(1);
    expect(result[0]?.displayName).toBe("Tom Lynch");
  });

  it("player fuzzy filter drops an unrelated name that exceeds the threshold", () => {
    const stats = [makeStats("Richmond", "Jack Riewoldt")];
    const result = applyStatsFilters(stats, { player: "ZZZZZZZZZZZZ" });
    expect(result).toHaveLength(0);
  });
});

describe("filterTeamStats", () => {
  it("uses --team as a canonical team-row filter", () => {
    const stats = [{ team: "Carlton" } as TeamStatsEntry, { team: "Richmond" } as TeamStatsEntry];
    expect(filterTeamStats(stats, "blues").map((entry) => entry.team)).toEqual(["Carlton"]);
  });
});
