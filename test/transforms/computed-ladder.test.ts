import { describe, expect, it } from "vitest";
import { computeLadder } from "../../src/transforms/computed-ladder";
import type { MatchResult } from "../../src/types";

function makeMatch(
  homeTeam: string,
  awayTeam: string,
  homePoints: number,
  awayPoints: number,
  roundNumber: number,
): MatchResult {
  return {
    matchId: `test_${roundNumber}_${homeTeam}_${awayTeam}`,
    season: 2024,
    roundNumber,
    roundType: "HomeAndAway",
    date: new Date(2024, 2, roundNumber),
    venue: "Test Ground",
    homeTeam,
    awayTeam,
    homeGoals: Math.floor(homePoints / 6),
    homeBehinds: homePoints % 6,
    homePoints,
    awayGoals: Math.floor(awayPoints / 6),
    awayBehinds: awayPoints % 6,
    awayPoints,
    margin: homePoints - awayPoints,
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
    venueState: null,
    venueTimezone: null,
    homeRushedBehinds: null,
    awayRushedBehinds: null,
    homeMinutesInFront: null,
    awayMinutesInFront: null,
    source: "afl-tables",
    competition: "AFLM",
  };
}

describe("computeLadder", () => {
  const results: MatchResult[] = [
    makeMatch("Sydney", "Melbourne", 86, 64, 1),
    makeMatch("Carlton", "Richmond", 86, 81, 1),
    makeMatch("Geelong", "St Kilda", 76, 68, 1),
    makeMatch("Sydney", "Carlton", 100, 80, 2),
    makeMatch("Melbourne", "Geelong", 90, 90, 2), // draw
  ];

  it("computes correct win/loss/draw records", () => {
    const ladder = computeLadder(results);

    const sydney = ladder.find((e) => e.team === "Sydney");
    expect(sydney).toBeDefined();
    expect(sydney?.wins).toBe(2);
    expect(sydney?.losses).toBe(0);
    expect(sydney?.draws).toBe(0);
    expect(sydney?.played).toBe(2);

    const melbourne = ladder.find((e) => e.team === "Melbourne");
    expect(melbourne?.wins).toBe(0);
    expect(melbourne?.losses).toBe(1);
    expect(melbourne?.draws).toBe(1);
  });

  it("calculates premiership points correctly", () => {
    const ladder = computeLadder(results);

    const sydney = ladder.find((e) => e.team === "Sydney");
    expect(sydney?.premiershipsPoints).toBe(8); // 2 wins * 4

    const melbourne = ladder.find((e) => e.team === "Melbourne");
    expect(melbourne?.premiershipsPoints).toBe(2); // 1 draw * 2
  });

  it("sorts by premiership points then percentage", () => {
    const ladder = computeLadder(results);

    // Sydney (8 pts) should be first
    expect(ladder[0]?.team).toBe("Sydney");
    expect(ladder[0]?.position).toBe(1);

    // Positions should be sequential
    for (let i = 0; i < ladder.length; i++) {
      expect(ladder[i]?.position).toBe(i + 1);
    }
  });

  it("respects upToRound filter", () => {
    const ladder = computeLadder(results, 1);

    // Only round 1 results
    const sydney = ladder.find((e) => e.team === "Sydney");
    expect(sydney?.played).toBe(1);
    expect(sydney?.wins).toBe(1);

    // Melbourne and Geelong round 2 draw should not be included
    const melbourne = ladder.find((e) => e.team === "Melbourne");
    expect(melbourne?.played).toBe(1);
    expect(melbourne?.draws).toBe(0);
  });

  it("excludes Finals matches", () => {
    const withFinals = [
      ...results,
      {
        ...makeMatch("Sydney", "Carlton", 100, 80, 25),
        roundType: "Finals" as const,
      },
    ];

    const ladder = computeLadder(withFinals);
    const sydney = ladder.find((e) => e.team === "Sydney");
    expect(sydney?.played).toBe(2); // Finals not counted
  });

  it("calculates percentage correctly", () => {
    const ladder = computeLadder(results);

    const sydney = ladder.find((e) => e.team === "Sydney");
    expect(sydney).toBeDefined();
    if (sydney) {
      const expected = (sydney.pointsFor / sydney.pointsAgainst) * 100;
      expect(sydney.percentage).toBeCloseTo(expected, 2);
    }
  });
});
