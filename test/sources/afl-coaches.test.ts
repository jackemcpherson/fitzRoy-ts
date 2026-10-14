import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer, Match } from "effect";
import { TestClock } from "effect/testing";
import {
  AflCoaches,
  AflCoachesLive,
  isFinalsRound,
  parseCoachesVotesHtml,
} from "../../src/sources/afl-coaches";
import { fixtureHttp, fixtureText, type RequestLog, type RouteAnswer } from "../support/http";

const fixtureHtml = fixtureText("afl-coaches-votes.html");

/** The live AFL Coaches client answering every request with `answer`. */
function coachesWith(answer: RouteAnswer, log?: RequestLog) {
  return AflCoachesLive.pipe(
    Layer.provide(fixtureHttp([["aflcoaches.com.au", answer]], log ? { log } : undefined)),
  );
}

/**
 * Run an effect while advancing the test clock, so the 250 ms inter-batch
 * gaps elapse while fixture responses settle on real timers.
 */
function withTicks<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(effect);

    while (fiber.pollUnsafe() === undefined) {
      yield* TestClock.adjust("250 millis");
      yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 1)));
    }

    return yield* Fiber.join(fiber);
  });
}

/** Round number from the last two digits of an AFLCA leaderboard URL. */
function roundOf(url: string): number {
  return Number.parseInt(/(\d{2})$/.exec(url)?.[1] ?? "0", 10);
}

describe("parseCoachesVotesHtml", () => {
  it("parses the fixture into coaches-vote records with the expected fields", () => {
    const votes = parseCoachesVotesHtml(fixtureHtml, 2024, 1, "AFLM");

    // Match 1: Cripps, Walsh, Martin (3) + Match 2: Dangerfield, Sicily (2).
    expect(votes).toHaveLength(5);

    const first = votes[0];
    expect(first).toBeDefined();

    if (!first) return;

    expect(first.type).toBe("coaches");
    expect(first.source).toBe("afl-coaches");
    expect(first.season).toBe(2024);
    expect(first.round).toBe(1);
    expect(first.competition).toBe("AFLM");
    expect(first.player).toBe("Patrick Cripps (Carlton)");
    expect(first.votes).toBe(10);
    expect(first.homeTeam).toBe("Carlton");
    expect(first.awayTeam).toBe("Richmond");
  });

  it("stamps every player in the first match with that match's home/away teams", () => {
    const votes = parseCoachesVotesHtml(fixtureHtml, 2024, 1, "AFLM");
    const matchOne = votes.filter((v) => v.homeTeam === "Carlton" && v.awayTeam === "Richmond");

    expect(matchOne.map((v) => v.player)).toEqual([
      "Patrick Cripps (Carlton)",
      "Sam Walsh (Carlton)",
      "Dustin Martin (Richmond)",
    ]);
    expect(matchOne.map((v) => v.votes)).toEqual([10, 8, 5]);
  });

  it("stamps a player in the second match with the second match's home/away teams (boundary)", () => {
    const votes = parseCoachesVotesHtml(fixtureHtml, 2024, 1, "AFLM");
    const dangerfield = votes.find((v) => v.player === "Patrick Dangerfield (Geelong)");

    expect(dangerfield).toBeDefined();

    if (!dangerfield) return;

    // The matchIndex must have advanced past match 1 — Geelong/Hawthorn, not Carlton/Richmond.
    expect(dangerfield.homeTeam).toBe("Geelong");
    expect(dangerfield.awayTeam).toBe("Hawthorn");
    expect(dangerfield.votes).toBe(9);
  });

  it("skips rows whose vote cell is non-numeric (NaN)", () => {
    const html = `<div class="pr-md-3 votes-by-match">
      <img class="club_logo" title="Carlton" />
      <img class="club_logo" title="Richmond" />
      <div class="col-10">Player (Club)</div><div class="col-2">Votes</div>
      <div class="col-10">Patrick Cripps (Carlton)</div><div class="col-2">10</div>
      <div class="col-10">Sam Walsh (Carlton)</div><div class="col-2">TBC</div>
    </div>`;

    const votes = parseCoachesVotesHtml(html, 2024, 1, "AFLM");

    expect(votes).toHaveLength(1);
    expect(votes[0]?.player).toBe("Patrick Cripps (Carlton)");
    // No record with a NaN/absent vote for the non-numeric row.
    expect(votes.some((v) => v.player === "Sam Walsh (Carlton)")).toBe(false);
  });

  it("skips rows for a match that has fewer club_logo titles than matches (missing team)", () => {
    // Two matches, but only the first carries club_logo elements. The second
    // match's rows reference homeTeams[1]/awayTeams[1] which are undefined.
    const html = `<div class="pr-md-3 votes-by-match">
      <img class="club_logo" title="Carlton" />
      <img class="club_logo" title="Richmond" />
      <div class="col-10">Player (Club)</div><div class="col-2">Votes</div>
      <div class="col-10">Patrick Cripps (Carlton)</div><div class="col-2">10</div>
      <div class="col-10">Player (Club)</div><div class="col-2">Votes</div>
      <div class="col-10">Patrick Dangerfield (Geelong)</div><div class="col-2">9</div>
    </div>`;

    const votes = parseCoachesVotesHtml(html, 2024, 1, "AFLM");

    // Only the first match's player survives.
    expect(votes).toHaveLength(1);
    expect(votes[0]?.player).toBe("Patrick Cripps (Carlton)");
    // No record was emitted with a null/empty team for the second match.
    expect(votes.some((v) => v.player === "Patrick Dangerfield (Geelong)")).toBe(false);
    expect(votes.every((v) => v.homeTeam.length > 0 && v.awayTeam.length > 0)).toBe(true);
  });

  it("returns an empty array for HTML with no votes-by-match container", () => {
    expect(parseCoachesVotesHtml("<html><body></body></html>", 2024, 1, "AFLM")).toEqual([]);
  });
});

describe("AflCoaches.scrapeRoundVotes", () => {
  it.effect("builds the AFLCA URL and parses the returned HTML (offline round-trip)", () => {
    const log: RequestLog = { urls: [], inits: [] };

    return Effect.gen(function* () {
      const coaches = yield* AflCoaches;
      const votes = yield* coaches.scrapeRoundVotes(2024, 1, "AFLM", false);

      expect(votes).toHaveLength(5);
      expect(votes[0]?.source).toBe("afl-coaches");

      // For season >= 2023 the path uses season/{season+1}{compSuffix}{roundPad}.
      expect(log.urls).toEqual([
        "https://aflcoaches.com.au/awards/the-aflca-champion-player-of-the-year-award/leaderboard/2024/20250101",
      ]);
    }).pipe(Effect.provide(coachesWith({ body: fixtureHtml }, log)));
  });

  it.effect("fails with a ScrapeError on a non-OK response", () =>
    Effect.gen(function* () {
      const coaches = yield* AflCoaches;
      const error = yield* coaches.scrapeRoundVotes(2024, 1, "AFLM", false).pipe(Effect.flip);

      expect(error._tag).toBe("ScrapeError");
      expect(error.statusCode).toBe(404);
    }).pipe(Effect.provide(coachesWith({ body: "", status: 404 }))),
  );
});

describe("AflCoaches.fetchSeasonVotes", () => {
  it.effect(
    "limits concurrency to three, preserves round order, and skips failed or empty rounds",
    () => {
      let inFlight = 0;
      let maxInFlight = 0;

      const respond = (url: string) => {
        const round = roundOf(url);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);

        return new Promise<Response>((resolve, reject) => {
          // Resolve each batch out of order while keeping later rounds fast.
          const delay = Match.value(round % 3).pipe(
            Match.when(1, () => 30),
            Match.when(2, () => 10),
            Match.orElse(() => 20),
          );

          setTimeout(() => {
            inFlight--;

            if (round === 2) {
              resolve(new Response("", { status: 503 }));
            } else if (round === 4) {
              resolve(new Response("<html></html>", { status: 200 }));
            } else if (round === 5) {
              resolve(new Response("", { status: 404 }));
            } else if (round === 6) {
              reject(new Error("connection reset"));
            } else {
              resolve(new Response(fixtureHtml, { status: 200 }));
            }
          }, delay);
        });
      };

      return Effect.gen(function* () {
        const coaches = yield* AflCoaches;
        const result = yield* withTicks(coaches.fetchSeasonVotes(2024, "AFLM"));

        expect(maxInFlight).toBe(3);
        const rounds = [...new Set(result.votes.map((vote) => vote.round))];
        expect(rounds).toEqual([1, 3, ...Array.from({ length: 24 }, (_, i) => i + 7)]);
        expect(result.failedRounds).toEqual([2, 6]);
      }).pipe(Effect.provide(coachesWith({ respond })));
    },
  );

  it.effect("fails when all rounds fail or contain no votes", () =>
    Effect.gen(function* () {
      const coaches = yield* AflCoaches;
      const error = yield* withTicks(coaches.fetchSeasonVotes(2024, "AFLM")).pipe(Effect.flip);

      expect(error.message).toContain("No coaches votes found for season 2024");
    }).pipe(Effect.provide(coachesWith({ body: "<html></html>" }))),
  );

  it.effect("fails when every round has an actual HTTP failure", () =>
    Effect.gen(function* () {
      const coaches = yield* AflCoaches;
      const error = yield* withTicks(coaches.fetchSeasonVotes(2024, "AFLM")).pipe(Effect.flip);

      expect(error._tag).toBe("ScrapeError");
    }).pipe(Effect.provide(coachesWith({ body: "", status: 503 }))),
  );
});

describe("isFinalsRound", () => {
  // 2023: 24 H&A rounds confirmed by probe (Gary Ayres jump at round 25)
  it("returns false for round 24 in 2023 (last H&A round)", () => {
    expect(isFinalsRound(2023, 24)).toBe(false);
  });

  it("returns true for round 25 in 2023 (first finals round)", () => {
    expect(isFinalsRound(2023, 25)).toBe(true);
  });

  // 2019: 23 H&A rounds confirmed by probe (Gary Ayres jump at round 24)
  it("returns false for round 23 in 2019 (last H&A round)", () => {
    expect(isFinalsRound(2019, 23)).toBe(false);
  });

  it("returns true for round 24 in 2019 (first finals round)", () => {
    expect(isFinalsRound(2019, 24)).toBe(true);
  });

  // 2024: 25 H&A rounds confirmed by probe (Gary Ayres jump at round 26)
  it("returns false for round 25 in 2024 (last H&A round)", () => {
    expect(isFinalsRound(2024, 25)).toBe(false);
  });

  it("returns true for round 26 in 2024 (first finals round)", () => {
    expect(isFinalsRound(2024, 26)).toBe(true);
  });

  // Pre-2018: default last H&A = 23; Gary Ayres URL returns 404 for finals
  // rounds in these seasons (silently skipped), but the boundary is correct.
  it("returns false for round 23 in 2017 (last H&A round, default boundary)", () => {
    expect(isFinalsRound(2017, 23)).toBe(false);
  });

  it("returns true for round 24 in 2017 (after H&A ends)", () => {
    expect(isFinalsRound(2017, 24)).toBe(true);
  });

  // 2010: 22 H&A rounds confirmed by probe
  it("returns false for round 22 in 2010 (last H&A round)", () => {
    expect(isFinalsRound(2010, 22)).toBe(false);
  });

  it("returns true for round 23 in 2010 (after H&A ends)", () => {
    expect(isFinalsRound(2010, 23)).toBe(true);
  });

  // 2011: Gold Coast joined → 17 teams → 24 H&A rounds.
  // Probe confirmed 2026-07-02: H&A URL returns DATA at round 24, HTTP 404 at
  // round 25. Gary Ayres returns empty for all rounds (pre-2018 behaviour).
  it("returns false for round 24 in 2011 (last H&A round — 24 H&A rounds that season)", () => {
    expect(isFinalsRound(2011, 24)).toBe(false);
  });

  it("returns true for round 25 in 2011 (first finals round)", () => {
    expect(isFinalsRound(2011, 25)).toBe(true);
  });

  // Default boundary applies to unlisted seasons (DEFAULT_LAST_HA_ROUND = 23)
  it("uses the default boundary (23) for an unlisted season", () => {
    expect(isFinalsRound(2015, 23)).toBe(false);
    expect(isFinalsRound(2015, 24)).toBe(true);
  });
});
