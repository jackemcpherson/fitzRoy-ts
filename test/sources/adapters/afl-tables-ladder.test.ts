import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ScrapeError } from "../../../src/lib/errors";
import { aflTablesLadderSource } from "../../../src/sources/adapters/afl-tables";
import { AflTables } from "../../../src/sources/afl-tables";
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
    matchClockPeriods: null,
    completedQuarter: null,
    attendance: null,
    weatherTempCelsius: null,
    weatherType: null,
    roundCode: `R${round}`,
    venueState: "VIC",
    venueTimezone: "Australia/Melbourne",
    venueLocalDate: null,
    homeRushedBehinds: null,
    awayRushedBehinds: null,
    homeMinutesInFront: null,
    awayMinutesInFront: null,
    source: "afl-tables",
    competition: "AFLM",
  };
}

/** An AFL Tables service whose season results are `matches`. */
function aflTablesWith(matches: Match[]) {
  const unused = Effect.fail(new ScrapeError({ message: "not used", source: "afl-tables" }));

  return Layer.succeed(AflTables, {
    fetchSeasonResults: () => Effect.succeed(matches),
    fetchSeasonPlayerStats: () => unused,
    fetchTeamStats: () => unused,
    fetchPlayerList: () => unused,
  });
}

describe("aflTablesLadderSource.asOfMatch (#119)", () => {
  it.effect("populates asOfMatch with the most recent completed match in scope", () => {
    const matches = [
      fakeMatch("AT_1", 1, "2024-03-15T09:30:00Z"),
      fakeMatch("AT_2", 1, "2024-03-16T03:00:00Z"),
      fakeMatch("AT_3", 2, "2024-03-22T09:30:00Z"),
    ];

    return Effect.gen(function* () {
      const source = yield* aflTablesLadderSource;

      const ladder = yield* source.fetchLadder({ source: "afl-tables", season: 2024 });

      expect(ladder.asOfMatch).toBe("AT_3");
      // Envelope stamps source consistently (#120).
      expect(ladder.source).toBe("afl-tables");
    }).pipe(Effect.provide(aflTablesWith(matches)));
  });

  it.effect(
    "when --round is passed, asOfMatch reflects the latest match at-or-before that round",
    () => {
      const matches = [
        fakeMatch("AT_1", 1, "2024-03-15T09:30:00Z"),
        fakeMatch("AT_2", 2, "2024-03-22T09:30:00Z"),
        fakeMatch("AT_3", 3, "2024-03-29T09:30:00Z"),
      ];

      return Effect.gen(function* () {
        const source = yield* aflTablesLadderSource;

        const ladder = yield* source.fetchLadder({ source: "afl-tables", season: 2024, round: 2 });

        expect(ladder.asOfMatch).toBe("AT_2");
      }).pipe(Effect.provide(aflTablesWith(matches)));
    },
  );

  it.effect("asOfMatch is null when no completed match is in scope", () =>
    Effect.gen(function* () {
      const source = yield* aflTablesLadderSource;

      const ladder = yield* source.fetchLadder({ source: "afl-tables", season: 2024 });

      expect(ladder.asOfMatch).toBeNull();
    }).pipe(Effect.provide(aflTablesWith([]))),
  );
});
