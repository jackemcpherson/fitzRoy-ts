import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fetchSquad } from "../../src/api/teams";
import { fixtureText, type Route } from "../support/http";
import { fixtureFitzroy } from "../support/services";

/** Each AFL-API URL the squad flow requests, routed to its fixture. */
const SQUAD_ROUTES: readonly Route[] = [
  ["compseasons?pageSize", { body: fixtureText("afl-api-compseasons-2024.json") }],
  ["/teams?", { body: fixtureText("afl-api-teams-aflm.json") }],
  ["/squads?", { body: fixtureText("afl-api-squads-carlton-2024.json") }],
  [
    /./,
    {
      respond: (url) => Promise.reject(new Error(`Unexpected URL in squad test: ${url}`)),
    },
  ],
];

describe("fetchSquad afl-api happy path", () => {
  it.effect("resolves comp-season, team id, then squad and maps players", () =>
    Effect.gen(function* () {
      const squad = yield* fetchSquad({ team: "Carlton", season: 2024, source: "afl-api" });

      expect(squad.teamName).toBe("Carlton");
      expect(squad.teamId).toBe("5");
      expect(squad.season).toBe(2024);
      expect(squad.scope).toBe("season");
      expect(squad.competition).toBe("AFLM");
      expect(squad.source).toBe("afl-api");
      expect(squad.players).toHaveLength(2);

      const cripps = squad.players.find((p) => p.surname === "Cripps");
      expect(cripps).toBeDefined();
      expect(cripps?.displayName).toBe("Patrick Cripps");
      expect(cripps?.jumperNumber).toBe(9);
      expect(cripps?.team).toBe("Carlton");
      expect(cripps?.playerId).toBe("CD_I1000900");
      expect(cripps?.draftYear).toBe(2013);
      expect(cripps?.heightCm).toBe(195);
      // AFL API squad endpoint carries no career counters.
      expect(cripps?.gamesPlayed).toBeNull();
    }).pipe(Effect.provide(fixtureFitzroy(SQUAD_ROUTES))),
  );
});

describe("fetchSquad public API dispatch", () => {
  it.effect("fails for unsupported squiggle source", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchSquad({
          team: "Carlton",
          season: 2024,
          source: "squiggle",
        }),
      );

      expect(error.message).toContain("squiggle does not provide squad");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for fryzigg source (player-stats only, not squad)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchSquad({
          team: "Carlton",
          season: 2024,
          source: "fryzigg",
        }),
      );

      expect(error.message).toContain("fryzigg does not provide squad");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for season below afl-api coverage (pre-2012)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchSquad({
          team: "Carlton",
          season: 2010,
          source: "afl-api",
        }),
      );

      expect(error.message).toContain("2010");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );
});
