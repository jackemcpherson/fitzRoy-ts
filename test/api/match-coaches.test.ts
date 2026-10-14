import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { fetchMatchCoaches } from "../../src/api/match-coaches";
import { normaliseTeamName } from "../../src/lib/team-mapping";
import { MatchCoaches, MatchCoachesLive } from "../../src/sources/match-coaches";
import {
  fixtureHttp,
  fixtureText,
  type Route,
  type RouteAnswer,
  requestLog,
} from "../support/http";
import { fixtureFitzroy } from "../support/services";

const fixture = (name: string) => fixtureText(`match-coaches/${name}`);

/** Serve the coach index for `coaches_idx.html` and `profile` for every other URL. */
function coachRoutes(index: string, profile: RouteAnswer): readonly Route[] {
  return [
    [/coaches_idx\.html$/, { body: index }],
    [/./, profile],
  ];
}

describe("fetchMatchCoaches", () => {
  it.effect("reads coach profiles rather than club navigation from the captured index", () => {
    const log = requestLog();

    return Effect.gen(function* () {
      const result = yield* fetchMatchCoaches({ season: 2022, batch: { limit: 1 } });

      expect(log.urls).toEqual([
        "https://afltables.com/afl/stats/coaches/coaches_idx.html",
        "https://afltables.com/afl/stats/coaches/Mick_Malthouse.html",
      ]);
      expect(result.batch?.nextCursor).not.toContain("/adelaide.html");
      expect(result.batch?.nextCursor).toContain("Jock_McHale.html");
    }).pipe(
      Effect.provide(
        fixtureFitzroy(
          coachRoutes(fixture("afl-tables-index-captured.html"), {
            body: fixture("afl-tables-hansen.html"),
          }),
          log,
        ),
      ),
    );
  });

  it.effect("returns sourced assignments and a complete envelope from AFL Tables", () =>
    Effect.gen(function* () {
      const result = yield* fetchMatchCoaches({ season: 2022 });

      expect(result.completeness).toEqual({ complete: true, failures: [] });
      expect(result.assignments).toEqual([
        expect.objectContaining({
          season: 2022,
          team: "Carlton",
          coachId: "afl-tables:https://afltables.com/afl/stats/coaches/Ashley_Hansen.html",
          coachName: "Ashley Hansen",
          matchId: "afl-tables:https://afltables.com/afl/stats/games/2022/030720220324.html",
          date: "2022-03-24",
          homeTeam: "Carlton",
          awayTeam: "Western Bulldogs",
          homePoints: 102,
          awayPoints: 90,
          source: "afl-tables",
        }),
      ]);
    }).pipe(
      Effect.provide(
        fixtureFitzroy(
          coachRoutes(fixture("afl-tables-index.html"), {
            body: fixture("afl-tables-hansen.html"),
          }),
        ),
      ),
    ),
  );

  it.effect("fails with an expected error when every upstream profile fails", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(fetchMatchCoaches({ season: 2022 }));

      expect(error.name).toBe("ScrapeError");
    }).pipe(
      Effect.provide(
        fixtureFitzroy(
          coachRoutes(fixture("afl-tables-index.html"), { body: "unavailable", status: 503 }),
        ),
      ),
    ),
  );

  it.effect("returns an empty complete result for a valid season with no assignments", () =>
    Effect.gen(function* () {
      const result = yield* fetchMatchCoaches({ season: 2022 });

      expect(result.assignments).toEqual([]);
      expect(result.completeness).toEqual({ complete: true, failures: [] });
    }).pipe(
      Effect.provide(
        fixtureFitzroy(
          coachRoutes(fixture("afl-tables-index.html"), {
            body: fixture("afl-tables-hansen.html").replaceAll("2022", "2021"),
          }),
        ),
      ),
    ),
  );

  it.effect("fails with structured errors for unsupported sources and competitions", () =>
    Effect.gen(function* () {
      const unsupportedSource = yield* Effect.flip(
        fetchMatchCoaches({ season: 2022, source: "afl-api" }),
      );

      expect(unsupportedSource.name).toBe("UnsupportedSourceError");

      const unsupportedCompetition = yield* Effect.flip(
        fetchMatchCoaches({
          season: 2022,
          source: "footywire",
          competition: "AFLW",
        }),
      );

      expect(unsupportedCompetition.name).toBe("UnsupportedCompetitionError");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it("keeps historical Bears and Fitzroy identities distinct from Brisbane Lions", () => {
    expect(normaliseTeamName("Bears")).toBe("Brisbane Bears");
    expect(normaliseTeamName("Fitzroy")).toBe("Fitzroy");
    expect(normaliseTeamName("Brisbane")).toBe("Brisbane Lions");
  });

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
      Effect.provide(
        MatchCoachesLive.pipe(
          Layer.provide(fixtureHttp([[/./, { body: fixture("footywire-match.html") }]])),
        ),
      ),
    ),
  );

  it.effect("reports a missing participant rather than complete FootyWire coverage", () =>
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

      expect(result.assignments).toHaveLength(1);
      expect(result.failures).toHaveLength(1);
    }).pipe(
      Effect.provide(
        MatchCoachesLive.pipe(
          Layer.provide(
            fixtureHttp([
              [
                /./,
                {
                  body: '<table><tr><td>Carlton Coach</td><td><a href="/afl/footy/cp-one">Coach A</a></td></tr></table>',
                },
              ],
            ]),
          ),
        ),
      ),
    ),
  );

  it.effect("rejects malformed source scores rather than trusting an assignment", () => {
    const original = fixture("afl-tables-hansen.html");
    const profile = original.replace(/<td[^>]*>102<\/td>/, "<td>unknown</td>");

    return Effect.gen(function* () {
      expect(profile).not.toBe(original);

      yield* Effect.flip(fetchMatchCoaches({ season: 2022 }));
    }).pipe(
      Effect.provide(
        fixtureFitzroy(coachRoutes(fixture("afl-tables-index.html"), { body: profile })),
      ),
    );
  });

  it.effect("limits profile batches and resumes the remaining profiles", () => {
    const log = requestLog();
    const profile = fixture("afl-tables-hansen.html");

    const routes: readonly Route[] = [
      [
        /coaches_idx\.html$/,
        {
          body: '<a href="Ashley_Hansen.html">Ashley Hansen</a><a href="Other_Coach.html">Other Coach</a>',
        },
      ],
      [/Other_Coach\.html$/, { body: profile.replaceAll("Ashley Hansen", "Other Coach") }],
      [/./, { body: profile }],
    ];

    return Effect.gen(function* () {
      const first = yield* fetchMatchCoaches({ season: 2022, batch: { limit: 1 } });

      expect(first.batch?.scope).toBe("pages");
      expect(first.batch?.nextCursor).toBeTruthy();
      expect(log.urls).toHaveLength(2);
      const nextCursor = first.batch?.nextCursor ?? "";

      const next = yield* fetchMatchCoaches({
        season: 2022,
        batch: { limit: 1, cursor: nextCursor },
      });

      expect(next.batch?.nextCursor).toBeNull();
      expect(log.urls).toHaveLength(3);
      expect(next.assignments[0]?.coachName).toBe("Other Coach");
    }).pipe(Effect.provide(fixtureFitzroy(routes, log)));
  });

  it.effect.each([
    [
      "bolton",
      "Brendon_Bolton",
      "Brendon Bolton",
      2014,
      "Hawthorn",
      ["102120140601", "101820140607", "031020140613", "041020140621", "102020140628"],
    ],
    ["connolly", "Chris_Connolly", "Chris Connolly", 2001, "Hawthorn", ["031020010729"]],
    [
      "teague",
      "David_Teague",
      "David Teague",
      2019,
      "Carlton",
      [
        "031920190608",
        "030720190615",
        "030820190630",
        "031120190707",
        "031620190713",
        "032020190720",
        "010320190727",
        "031820190804",
        "031420190811",
        "031520190817",
        "030920190824",
      ],
    ],
  ] as const)("preserves exact source credits for %s", ([slug, key, name, season, team, ids]) =>
    Effect.gen(function* () {
      const result = yield* fetchMatchCoaches({ season });

      expect(result.completeness).toEqual({ complete: true, failures: [] });
      expect(result.assignments.map((row) => [row.team, row.coachName, row.matchId])).toEqual(
        ids.map((id) => [
          team,
          name,
          `afl-tables:https://afltables.com/afl/stats/games/${season}/${id}.html`,
        ]),
      );
    }).pipe(
      Effect.provide(
        fixtureFitzroy(
          coachRoutes(`<a href="${key}.html">${name}</a>`, {
            body: fixture(`afl-tables-${slug}.html`),
          }),
        ),
      ),
    ),
  );
});
