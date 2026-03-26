import { describe, expect, it } from "vitest";
import type { MatchItem } from "../../src/lib/validation";
import { transformMatchItems } from "../../src/transforms/match-results";

/** Minimal match item for testing. */
function makeMatchItem(overrides?: Partial<MatchItem>): MatchItem {
  return {
    match: {
      matchId: "CD_M1",
      status: "CONCLUDED",
      utcStartTime: "2025-03-13T08:30:00",
      homeTeamId: "CD_T120",
      awayTeamId: "CD_T30",
      homeTeam: { name: "Richmond", teamId: "CD_T120" },
      awayTeam: { name: "Carlton", teamId: "CD_T30" },
    },
    score: {
      status: "CONCLUDED",
      matchId: "CD_M1",
      homeTeamScore: {
        matchScore: { totalScore: 82, goals: 13, behinds: 4 },
        periodScore: [
          { periodNumber: 1, score: { totalScore: 7, goals: 1, behinds: 1 } },
          { periodNumber: 2, score: { totalScore: 18, goals: 3, behinds: 0 } },
          { periodNumber: 3, score: { totalScore: 32, goals: 5, behinds: 2 } },
          { periodNumber: 4, score: { totalScore: 25, goals: 4, behinds: 1 } },
        ],
      },
      awayTeamScore: {
        matchScore: { totalScore: 69, goals: 9, behinds: 15 },
        periodScore: [
          { periodNumber: 1, score: { totalScore: 34, goals: 5, behinds: 4 } },
          { periodNumber: 2, score: { totalScore: 16, goals: 2, behinds: 4 } },
          { periodNumber: 3, score: { totalScore: 7, goals: 1, behinds: 1 } },
          { periodNumber: 4, score: { totalScore: 12, goals: 1, behinds: 6 } },
        ],
      },
    },
    venue: { name: "MCG" },
    round: { name: "Round 1", roundId: "CD_R1", roundNumber: 1 },
    ...overrides,
  };
}

/** Helper to get first result or fail test. */
function first<T>(arr: T[]): T {
  expect(arr.length).toBeGreaterThanOrEqual(1);
  return arr[0] as T;
}

describe("transformMatchItems", () => {
  it("transforms a match item into a MatchResult", () => {
    const results = transformMatchItems([makeMatchItem()], 2025, "AFLM");

    expect(results).toHaveLength(1);
    const r = first(results);
    expect(r.matchId).toBe("CD_M1");
    expect(r.season).toBe(2025);
    expect(r.roundNumber).toBe(1);
    expect(r.homeTeam).toBe("Richmond");
    expect(r.awayTeam).toBe("Carlton");
    expect(r.homeGoals).toBe(13);
    expect(r.homeBehinds).toBe(4);
    expect(r.homePoints).toBe(82);
    expect(r.awayGoals).toBe(9);
    expect(r.awayBehinds).toBe(15);
    expect(r.awayPoints).toBe(69);
    expect(r.margin).toBe(13);
    expect(r.venue).toBe("MCG");
    expect(r.status).toBe("Complete");
    expect(r.source).toBe("afl-api");
    expect(r.competition).toBe("AFLM");
  });

  it("extracts per-quarter scores", () => {
    const results = transformMatchItems([makeMatchItem()], 2025, "AFLM");
    const r = first(results);

    expect(r.q1Home).toEqual({ goals: 1, behinds: 1, points: 7 });
    expect(r.q2Home).toEqual({ goals: 3, behinds: 0, points: 18 });
    expect(r.q3Home).toEqual({ goals: 5, behinds: 2, points: 32 });
    expect(r.q4Home).toEqual({ goals: 4, behinds: 1, points: 25 });

    expect(r.q1Away).toEqual({ goals: 5, behinds: 4, points: 34 });
    expect(r.q4Away).toEqual({ goals: 1, behinds: 6, points: 12 });
  });

  it("handles missing score gracefully", () => {
    const item = makeMatchItem({ score: undefined });
    const r = first(transformMatchItems([item], 2025, "AFLM"));

    expect(r.homePoints).toBe(0);
    expect(r.awayPoints).toBe(0);
    expect(r.margin).toBe(0);
    expect(r.q1Home).toBeNull();
  });

  it("handles missing periodScore gracefully", () => {
    const item = makeMatchItem({
      score: {
        status: "CONCLUDED",
        matchId: "CD_M1",
        homeTeamScore: {
          matchScore: { totalScore: 50, goals: 7, behinds: 8 },
        },
        awayTeamScore: {
          matchScore: { totalScore: 69, goals: 9, behinds: 15 },
        },
      },
    });
    const r = first(transformMatchItems([item], 2025, "AFLM"));

    expect(r.homePoints).toBe(50);
    expect(r.q1Home).toBeNull();
    expect(r.q2Home).toBeNull();
  });

  it("normalises team names", () => {
    const item = makeMatchItem();
    item.match.homeTeam.name = "GWS Giants";
    item.match.awayTeam.name = "Footscray";
    const r = first(transformMatchItems([item], 2025, "AFLM"));

    expect(r.homeTeam).toBe("GWS Giants");
    expect(r.awayTeam).toBe("Western Bulldogs");
  });

  it("maps status strings correctly", () => {
    const upcoming = makeMatchItem();
    upcoming.match.status = "UPCOMING";
    const live = makeMatchItem();
    live.match.status = "LIVE";

    const results = transformMatchItems([upcoming, live], 2025, "AFLM");
    expect(results[0]?.status).toBe("Upcoming");
    expect(results[1]?.status).toBe("Live");
  });

  it("handles missing venue", () => {
    const item = makeMatchItem({ venue: undefined });
    const results = transformMatchItems([item], 2025, "AFLM");
    expect(results[0]?.venue).toBe("");
  });

  it("handles missing round info", () => {
    const item = makeMatchItem({ round: undefined });
    const results = transformMatchItems([item], 2025, "AFLM");
    expect(results[0]?.roundNumber).toBe(0);
  });

  it("parses UTC date from match", () => {
    const r = first(transformMatchItems([makeMatchItem()], 2025, "AFLM"));
    expect(r.date).toBeInstanceOf(Date);
    expect(r.date.getUTCFullYear()).toBe(2025);
  });

  it("transforms multiple items", () => {
    const items = [makeMatchItem(), makeMatchItem()];
    const second = items[1];
    if (second) second.match.matchId = "CD_M2";
    const results = transformMatchItems(items, 2025, "AFLM");
    expect(results).toHaveLength(2);
    expect(results[1]?.matchId).toBe("CD_M2");
  });

  it("returns empty array for empty input", () => {
    expect(transformMatchItems([], 2025, "AFLM")).toEqual([]);
  });
});
