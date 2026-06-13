import { describe, expect, it, vi } from "vitest";
import { AflTablesLadderSource } from "../../../src/sources/adapters/afl-tables";
import type { AflTablesClient } from "../../../src/sources/afl-tables";
import type { Match } from "../../../src/types";

function fakeMatch(matchId: string, round: number, dateIso: string): Match {
  return {
    matchId,
    season: 2024,
    roundNumber: round,
    roundType: "HomeAndAway",
    roundName: `Round ${round}`,
    date: new Date(dateIso),
    venue: "MCG",
    homeTeam: "Carlton",
    awayTeam: "Richmond",
    homeGoals: 12,
    homeBehinds: 10,
    homePoints: 82,
    awayGoals: 10,
    awayBehinds: 9,
    awayPoints: 69,
    margin: 13,
    q1Home: null,
    q2Home: null,
    q3Home: null,
    q4Home: null,
    q1Away: null,
    q2Away: null,
    q3Away: null,
    q4Away: null,
    status: "Complete",
    livePeriodStatus: null,
    attendance: null,
    weatherTempCelsius: null,
    weatherType: null,
    roundCode: `R${round}`,
    venueState: "VIC",
    venueTimezone: "Australia/Melbourne",
    homeRushedBehinds: null,
    awayRushedBehinds: null,
    homeMinutesInFront: null,
    awayMinutesInFront: null,
    source: "afl-tables",
    competition: "AFLM",
  };
}

describe("AflTablesLadderSource.asOfMatch (#119)", () => {
  function clientStub(matches: Match[]): AflTablesClient {
    return {
      fetchSeasonResults: vi.fn(async () => ({ success: true as const, data: matches })),
    } as unknown as AflTablesClient;
  }

  it("populates asOfMatch with the most recent completed match in scope", async () => {
    const matches = [
      fakeMatch("AT_1", 1, "2024-03-15T09:30:00Z"),
      fakeMatch("AT_2", 1, "2024-03-16T03:00:00Z"),
      fakeMatch("AT_3", 2, "2024-03-22T09:30:00Z"),
    ];
    const source = new AflTablesLadderSource(clientStub(matches));

    const result = await source.fetchLadder({ source: "afl-tables", season: 2024 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.asOfMatch).toBe("AT_3");
    // Envelope stamps source consistently (#120).
    expect(result.data.source).toBe("afl-tables");
  });

  it("when --round is passed, asOfMatch reflects the latest match at-or-before that round", async () => {
    const matches = [
      fakeMatch("AT_1", 1, "2024-03-15T09:30:00Z"),
      fakeMatch("AT_2", 2, "2024-03-22T09:30:00Z"),
      fakeMatch("AT_3", 3, "2024-03-29T09:30:00Z"),
    ];
    const source = new AflTablesLadderSource(clientStub(matches));

    const result = await source.fetchLadder({ source: "afl-tables", season: 2024, round: 2 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.asOfMatch).toBe("AT_2");
  });

  it("asOfMatch is null when no completed match is in scope", async () => {
    const source = new AflTablesLadderSource(clientStub([]));

    const result = await source.fetchLadder({ source: "afl-tables", season: 2024 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.asOfMatch).toBeNull();
  });
});
