import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { MatchCoaches, MatchCoachesLive } from "../../src/sources/match-coaches";
import { fixtureHttp, fixtureText, type Route, requestLog } from "../support/http";

const fixture = (name: string) => fixtureText(`match-coaches/${name}`);

/** The live match-coach reader over fixture routes. */
function coachesWith(routes: readonly Route[], log = requestLog()) {
  return MatchCoachesLive.pipe(Layer.provide(fixtureHttp(routes, { log })));
}

const AFL_TABLES_ROUTES: readonly Route[] = [
  [/coaches_idx\.html$/, { body: fixture("afl-tables-index-captured.html") }],
  ["afltables.com/afl/stats/coaches/", { body: fixture("afl-tables-hansen.html") }],
];

describe("MatchCoaches.fetchAflTablesSeason", () => {
  it.effect("reads one coach profile per batch and returns a resumable cursor", () => {
    const log = requestLog();

    return Effect.gen(function* () {
      const coaches = yield* MatchCoaches;
      const result = yield* coaches.fetchAflTablesSeason(2022, { limit: 1 });

      expect(log.urls).toEqual([
        "https://afltables.com/afl/stats/coaches/coaches_idx.html",
        "https://afltables.com/afl/stats/coaches/Mick_Malthouse.html",
      ]);
      expect(result.batch?.nextCursor).not.toContain("/adelaide.html");
      expect(result.batch?.nextCursor).toContain("Jock_McHale.html");

      const cursor = result.batch?.nextCursor ?? "";
      const resumed = yield* coaches.fetchAflTablesSeason(2022, { limit: 1, cursor });

      expect(log.urls).toHaveLength(3);
      expect(log.urls[2]).not.toContain("coaches_idx.html");
      expect(resumed.batch?.completedCoachIds).toHaveLength(1);
    }).pipe(Effect.provide(coachesWith(AFL_TABLES_ROUTES, log)));
  });

  it.effect("parses Games Coached rows for the requested season", () =>
    Effect.gen(function* () {
      const coaches = yield* MatchCoaches;
      const result = yield* coaches.fetchAflTablesSeason(2022);

      expect(result.failures).toEqual([]);
      expect(result.batch).toBeUndefined();
      expect(result.assignments).toEqual([
        expect.objectContaining({
          season: 2022,
          team: "Carlton",
          coachName: "Ashley Hansen",
          matchId: "afl-tables:https://afltables.com/afl/stats/games/2022/030720220324.html",
          date: "2022-03-24",
          source: "afl-tables",
        }),
      ]);
    }).pipe(
      Effect.provide(
        coachesWith([
          [/coaches_idx\.html$/, { body: fixture("afl-tables-index.html") }],
          ["afltables.com/afl/stats/coaches/", { body: fixture("afl-tables-hansen.html") }],
        ]),
      ),
    ),
  );

  it.effect("fails with a ScrapeError for a malformed or foreign-season cursor", () =>
    Effect.gen(function* () {
      const coaches = yield* MatchCoaches;

      for (const cursor of ["not json", JSON.stringify({ season: 2021, pages: [] })]) {
        const error = yield* coaches
          .fetchAflTablesSeason(2022, { limit: 1, cursor })
          .pipe(Effect.flip);

        expect(error.message).toBe("Invalid season-specific coaching cursor");
      }
    }).pipe(Effect.provide(coachesWith(AFL_TABLES_ROUTES))),
  );

  it.effect("fails when the batch limit is outside one to five", () =>
    Effect.gen(function* () {
      const coaches = yield* MatchCoaches;
      const error = yield* coaches.fetchAflTablesSeason(2022, { limit: 6 }).pipe(Effect.flip);

      expect(error.message).toBe("Batch limit must be between one and five profiles");
    }).pipe(Effect.provide(coachesWith(AFL_TABLES_ROUTES))),
  );
});

describe("MatchCoaches.fetchFootyWireMatches", () => {
  it.effect("extracts explicit FootyWire match-page coach assignments", () =>
    Effect.gen(function* () {
      const coaches = yield* MatchCoaches;

      const result = yield* coaches.fetchFootyWireMatches([
        {
          competition: "AFLM",
          season: 2024,
          matchId: "FW_11174",
          date: new Date("2024-03-16T00:00:00Z"),
          homeTeam: "Adelaide Crows",
          awayTeam: "Richmond",
          homePoints: 90,
          awayPoints: 70,
          roundName: "Round 1",
        },
      ]);

      expect(result.failures).toEqual([]);
      expect(result.assignments).toEqual([
        expect.objectContaining({
          team: "Adelaide Crows",
          coachId: "footywire:https://www.footywire.com/afl/footy/cp-example",
          coachName: "Example Home Coach",
          matchId: "footywire:FW_11174",
          source: "footywire",
        }),
        expect.objectContaining({ team: "Richmond", coachName: "Example Away Coach" }),
      ]);
    }).pipe(
      Effect.provide(coachesWith([["footywire.com", { body: fixture("footywire-match.html") }]])),
    ),
  );

  it.effect("records a failed page instead of failing the run", () =>
    Effect.gen(function* () {
      const coaches = yield* MatchCoaches;

      const result = yield* coaches.fetchFootyWireMatches([
        {
          competition: "AFLM",
          season: 2024,
          matchId: "FW_1",
          date: new Date("2024-03-16"),
          homeTeam: "Carlton",
          awayTeam: "Richmond",
          homePoints: 81,
          awayPoints: 74,
          roundName: "Round 1",
        },
      ]);

      expect(result.assignments).toEqual([]);
      expect(result.failures).toEqual([
        {
          url: "https://www.footywire.com/afl/footy/ft_match_statistics?mid=1",
          reason:
            "footywire request failed: 500 (https://www.footywire.com/afl/footy/ft_match_statistics?mid=1)",
          scope: "match:FW_1",
          matchId: "footywire:FW_1",
        },
      ]);
    }).pipe(Effect.provide(coachesWith([["footywire.com", { body: "", status: 500 }]]))),
  );
});
