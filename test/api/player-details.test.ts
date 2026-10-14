import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fetchPlayerDetails } from "../../src/api/player-details";
import { ScrapeError, type SourceError } from "../../src/lib/errors";
import { AFL_SENIOR_TEAMS } from "../../src/lib/team-mapping";
import type { SquadSource } from "../../src/sources/adapters/capabilities";
import { CapabilityRegistry } from "../../src/sources/adapters/registry";
import type { DataSource, Player, Squad, SquadQuery } from "../../src/types";
import { fixtureText, type Route } from "../support/http";
import { FULL_COVERAGE, fixtureFitzroy, stubRegistry } from "../support/services";

/**
 * `fetchPlayerDetails` is a denormalised view over `fetchSquad`, so the
 * single-team flow makes the same comp-season → team-id → squad chain.
 */
const SQUAD_ROUTES: readonly Route[] = [
  ["compseasons?pageSize", { body: fixtureText("afl-api-compseasons-2024.json") }],
  ["/teams?", { body: fixtureText("afl-api-teams-aflm.json") }],
  ["/squads?", { body: fixtureText("afl-api-squads-carlton-2024.json") }],
  [
    /./,
    {
      respond: (url) => Promise.reject(new Error(`Unexpected URL in player-details test: ${url}`)),
    },
  ],
];

/**
 * A registry whose only squad adapter is `source`, answering each query
 * with `answer` and recording every query it receives.
 */
function squadRegistry(
  source: DataSource,
  answer: (query: SquadQuery) => Effect.Effect<Squad, SourceError>,
  calls: SquadQuery[] = [],
) {
  const adapter: SquadSource = {
    id: source,
    coverage: FULL_COVERAGE,
    fetchSquad: (query) => {
      calls.push(query);

      return answer(query);
    },
  };

  return stubRegistry({ squad: new CapabilityRegistry(source, [adapter]) });
}

const networkFailure = () =>
  Effect.fail(new ScrapeError({ message: "network failure", source: "afl-api" }));

describe("fetchPlayerDetails afl-api happy path", () => {
  it.effect("projects a single team's squad into flat player-detail rows", () =>
    Effect.gen(function* () {
      const result = yield* fetchPlayerDetails({
        source: "afl-api",
        team: "Carlton",
        season: 2024,
      });

      expect(result.players).toHaveLength(2);
      expect(result.failedTeams).toEqual([]);
      expect(result.scope).toBe("season");

      const walsh = result.players.find((p) => p.surname === "Walsh");
      expect(walsh).toBeDefined();
      expect(walsh?.displayName).toBe("Sam Walsh");
      expect(walsh?.team).toBe("Carlton");
      expect(walsh?.jumperNumber).toBe(3);
      expect(walsh?.draftPosition).toBe(1);
      expect(walsh?.source).toBe("afl-api");
      expect(walsh?.competition).toBe("AFLM");
    }).pipe(Effect.provide(fixtureFitzroy(SQUAD_ROUTES))),
  );
});

describe("fetchPlayerDetails public API dispatch", () => {
  it.effect("fails for fryzigg source (player-stats only, no squad capability)", () =>
    // Regression guard for #126: before the dispatch guard was added,
    // sources without a squad capability silently returned [] for every
    // team and produced an empty array with exit 0.
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchPlayerDetails({
          source: "fryzigg",
          team: "Carlton",
          season: 2024,
        }),
      );

      expect(error.message).toContain("fryzigg does not provide squad");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for squiggle source (no squad capability)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchPlayerDetails({
          source: "squiggle",
          team: "Carlton",
          season: 2024,
        }),
      );

      expect(error.message).toContain("squiggle does not provide squad");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for season below afl-api coverage (pre-2012)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchPlayerDetails({
          source: "afl-api",
          team: "Carlton",
          season: 2010,
        }),
      );

      expect(error.message).toContain("2010");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );
});

describe("fetchPlayerDetails default-season resolution (#149)", () => {
  it.effect("fails with a provider error instead of inventing the omitted season", () => {
    const calls: SquadQuery[] = [];

    return Effect.gen(function* () {
      yield* Effect.flip(
        fetchPlayerDetails({
          source: "afl-api",
          team: "Carlton",
          competition: "AFLW",
        }),
      );

      expect(calls).toEqual([]);
    }).pipe(
      Effect.provide(squadRegistry("afl-api", networkFailure, calls)),
      Effect.provide(fixtureFitzroy([[/./, { body: "", status: 500 }]])),
    );
  });
});

describe("fetchPlayerDetails all-teams failure modes (#155)", () => {
  it.effect("fails when every team squad fetch fails", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(fetchPlayerDetails({ source: "afl-api", season: 2024 }));

      expect(error.message).toContain("2024");
      expect(error.message).toContain("afl-api");
    }).pipe(
      Effect.provide(squadRegistry("afl-api", networkFailure)),
      Effect.provide(fixtureFitzroy()),
    ),
  );

  it.effect("returns partial results when some team squad fetches fail", () => {
    const mockPlayer: Player = {
      playerId: "1",
      givenName: "Sam",
      surname: "Walsh",
      displayName: "Sam Walsh",
      jumperNumber: 3,
      position: null,
      dateOfBirth: null,
      heightCm: null,
      weightKg: null,
      draftYear: null,
      draftPosition: null,
      draftType: null,
      debutYear: null,
      recruitedFrom: null,
      gamesPlayed: null,
      goals: null,
      team: "Carlton",
      source: "afl-api",
      competition: "AFLM",
    };

    const carltonOnly = (query: SquadQuery) =>
      query.team === "Carlton"
        ? Effect.succeed<Squad>({
            teamId: "1",
            teamName: "Carlton",
            season: 2024,
            scope: "season",
            players: [mockPlayer],
            competition: "AFLM",
            source: "afl-api",
          })
        : networkFailure();

    return Effect.gen(function* () {
      const result = yield* fetchPlayerDetails({ source: "afl-api", season: 2024 });

      // The one successful Carlton squad contributes exactly one player.
      expect(result.players).toHaveLength(1);
      expect(result.players[0]?.displayName).toBe("Sam Walsh");
      expect(result.players[0]?.team).toBe("Carlton");
      expect(result.failedTeams).toEqual(
        [...AFL_SENIOR_TEAMS].filter((team) => team !== "Carlton"),
      );
      expect(result.scope).toBe("season");
    }).pipe(
      Effect.provide(squadRegistry("afl-api", carltonOnly)),
      Effect.provide(fixtureFitzroy()),
    );
  });
});

describe("fetchPlayerDetails scope", () => {
  it.effect("reports all-time scope from scraped player lists", () =>
    Effect.gen(function* () {
      const result = yield* fetchPlayerDetails({
        source: "footywire",
        team: "Carlton",
        season: 2024,
      });

      expect(result.scope).toBe("all-time");
      expect(result.failedTeams).toEqual([]);
    }).pipe(
      Effect.provide(
        squadRegistry("footywire", () =>
          Effect.succeed({
            teamId: "Carlton",
            teamName: "Carlton",
            season: 2024,
            scope: "all-time",
            players: [],
            competition: "AFLM",
            source: "footywire",
          }),
        ),
      ),
      Effect.provide(fixtureFitzroy()),
    ),
  );
});
