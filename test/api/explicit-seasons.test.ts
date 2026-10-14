import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Result, Schema } from "effect";
import { fetchMatches } from "../../src/api/match";
import { fetchPlayerStats } from "../../src/api/player-stats";
import { AmbiguousSeasonError } from "../../src/lib/errors";
import { canonicalSeasonKey } from "../../src/lib/seasons";
import { CompseasonListSchema } from "../../src/lib/validation";
import { aflApiMatchSource, aflApiPlayerStatsSource } from "../../src/sources/adapters/afl-api";
import { AflApi, AflApiLive } from "../../src/sources/afl-api";
import { fixtureHttp, fixtureText, type Route, requestLog } from "../support/http";
import { fixtureFitzroy } from "../support/services";

/** The raw AFLW provider season list (Season 6 is id 41, Season 7 is id 51). */
const SEASONS_JSON = fixtureText("aflw-provider-seasons.json");

const MatchList = Schema.Array(Schema.Struct({ match: Schema.Struct({ matchId: Schema.String }) }));

/** The captured raw match inventory for one AFLW 2022 season. */
const inventory = (key: string) => fixtureText(`aflw-${key}-matches.json`);

/** One round per provider season; its provider ID names the inventory to serve. */
const roundsFor = (providerId: string) =>
  JSON.stringify({
    rounds: [
      { id: 1, providerId, name: "Round 1", roundNumber: 1, utcStartTime: "2022-08-25T09:00:00Z" },
    ],
  });

/**
 * The AFL API routes for AFLW 2022: the provider season list, one round per
 * season, and the captured 75- and 99-match inventories.
 */
function aflwRoutes(compseasons: string = SEASONS_JSON): readonly Route[] {
  return [
    ["WMCTok", { body: JSON.stringify({ token: "test-token" }) }],
    ["/competitions/3/compseasons", { body: compseasons }],
    ["/compseasons/41/rounds", { body: roundsFor("S6") }],
    ["/compseasons/51/rounds", { body: roundsFor("S7") }],
    ["/matchItems/round/S6", { body: `{"items":${inventory("2022-S6")}}` }],
    ["/matchItems/round/S7", { body: `{"items":${inventory("2022-S7")}}` }],
  ];
}

/** The live AFL API client over the AFLW routes. */
function aflApiOver(routes: readonly Route[], log = requestLog()) {
  return AflApiLive.pipe(Layer.provide(fixtureHttp(routes, { log })));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("explicit competition seasons", () => {
  it.effect("discovers both provider mappings without depending on list order", () =>
    Effect.gen(function* () {
      const api = yield* AflApi;
      const seasons = yield* api.fetchSeasons("AFLW");

      expect(seasons.filter((s) => s.year === 2022)).toEqual([
        {
          competition: "AFLW",
          seasonKey: "2022-S6",
          year: 2022,
          displayName: "2022 NAB AFLW Season 6",
          providerSeasonId: 41,
        },
        {
          competition: "AFLW",
          seasonKey: "2022-S7",
          year: 2022,
          displayName: "2022 NAB AFLW Season 7",
          providerSeasonId: 51,
        },
      ]);
      expect(yield* api.resolveCompSeason("AFLW", "2022-S6")).toBe(41);
      expect(yield* api.resolveCompSeason("AFLW", "2022-S7")).toBe(51);
    }).pipe(Effect.provide(aflApiOver(aflwRoutes()))),
  );

  it.effect(
    "rejects ambiguous public requests and invalid competition selectors before any fetch",
    () => {
      const log = requestLog();

      return Effect.gen(function* () {
        const query = { source: "afl-api", competition: "AFLW", season: 2022 } as const;

        const errors = [
          yield* Effect.flip(fetchMatches(query)),
          yield* Effect.flip(fetchPlayerStats(query)),
        ];

        for (const error of errors) {
          expect(error).toBeInstanceOf(AmbiguousSeasonError);
          expect(error).toMatchObject({ validSelectors: ["2022-S6", "2022-S7"] });
        }

        expect(Result.isFailure(canonicalSeasonKey("AFLM", "2022-S6"))).toBe(true);
        expect(canonicalSeasonKey("AFLM", 2022)).toEqual(Result.succeed("2022"));
        expect(log.urls).toEqual([]);
      }).pipe(Effect.provide(fixtureFitzroy([], log)));
    },
  );

  it.effect("keeps the captured 75 and 99 match inventories separate", () =>
    Effect.gen(function* () {
      const adapter = yield* aflApiMatchSource;

      const six = yield* adapter.fetchMatches({
        source: "afl-api",
        competition: "AFLW",
        season: "2022-S6",
      });

      const seven = yield* adapter.fetchMatches({
        source: "afl-api",
        competition: "AFLW",
        season: "2022-S7",
      });

      expect(six.length).toBe(75);
      expect(seven.length).toBe(99);

      const first = new Set(six.map((m) => m.matchId));
      expect(seven.every((m) => !first.has(m.matchId) && m.season === 2022)).toBe(true);
    }).pipe(Effect.provide(aflApiOver(aflwRoutes()))),
  );

  it.effect("rejects a match-ID shortcut from the other season before fetching statistics", () => {
    const log = requestLog();

    const matchId = Schema.decodeUnknownSync(MatchList)(JSON.parse(inventory("2022-S7")))[0]?.match
      .matchId;

    return Effect.gen(function* () {
      expect(matchId).toBeDefined();
      const adapter = yield* aflApiPlayerStatsSource;

      yield* Effect.flip(
        adapter.fetchPlayerStats({
          source: "afl-api",
          competition: "AFLW",
          season: "2022-S6",
          matchId,
        }),
      );

      expect(log.urls.some((url) => url.includes("/playerStats/"))).toBe(false);
    }).pipe(Effect.provide(aflApiOver(aflwRoutes(), log)));
  });

  it.effect(
    "resolves season seven as current even when season six occurs first in the provider list",
    () => {
      const seasons = Schema.decodeUnknownSync(CompseasonListSchema)(JSON.parse(SEASONS_JSON));

      const sixThenSeven = JSON.stringify({
        compSeasons: seasons.compSeasons.filter((s) => s.id === 41 || s.id === 51),
      });

      return Effect.gen(function* () {
        vi.spyOn(Date, "now").mockReturnValue(Date.parse("2022-09-01T00:00:00Z"));
        const api = yield* AflApi;

        expect(yield* api.resolveCurrentSeason("AFLW")).toBe("2022-S7");
      }).pipe(Effect.provide(aflApiOver(aflwRoutes(sixThenSeven))));
    },
  );
});

it.effect("does not relabel the pinned January Fryzigg snapshot as AFLW season seven", () => {
  const log = requestLog();

  return Effect.gen(function* () {
    const error = yield* Effect.flip(
      fetchPlayerStats({
        source: "fryzigg",
        competition: "AFLW",
        season: "2022-S7",
      }),
    );

    expect(error.message).toContain("season six only");
    expect(log.urls).toEqual([]);
  }).pipe(Effect.provide(fixtureFitzroy([], log)));
});
