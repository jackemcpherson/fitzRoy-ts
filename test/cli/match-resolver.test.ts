/**
 * Tests for resolveMatchId — the precondition + prompt-fallback paths
 * that the team and stats CLI commands previously inlined.
 */

import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { matchIdForPlayerStatsSource, resolveMatchId } from "../../src/cli/match-resolver";
import { MatchItemListSchema } from "../../src/lib/validation/afl-api-cfs";
import { AflApi, AflApiLive } from "../../src/sources/afl-api";
import { fixtureHttp, fixtureText, requestLog } from "../support/http";

/** The live AFL API service over a fixture fetch that answers nothing. */
function offlineAflApi(log = requestLog()) {
  return AflApiLive.pipe(Layer.provide(fixtureHttp([], { log })));
}

/** The AFL API service with round 1 2025 answered from a committed fixture. */
const roundOneAflApi = Layer.effect(
  AflApi,
  Effect.gen(function* () {
    const live = yield* AflApi;

    const { items } = Schema.decodeUnknownSync(MatchItemListSchema)(
      JSON.parse(fixtureText("afl-api-round-1-2025.json")),
    );

    return {
      ...live,
      resolveCompSeason: () => Effect.succeed(73),
      fetchRoundMatchItemsByNumber: () => Effect.succeed(items),
    };
  }),
).pipe(Layer.provide(offlineAflApi()));

describe("matchIdForPlayerStatsSource", () => {
  const nameResolution = {
    matchId: "CD_M20250140101",
    participants: { homeTeam: "Carlton", awayTeam: "Richmond" },
  };

  it("keeps a name-resolved identifier for AFL API", () => {
    expect(matchIdForPlayerStatsSource("afl-api", nameResolution)).toBe("CD_M20250140101");
  });

  it.each(["footywire", "afl-tables", "fryzigg"] as const)(
    "uses participants instead of an AFL API identifier for %s",
    (source) => {
      expect(matchIdForPlayerStatsSource(source, nameResolution)).toBeUndefined();
    },
  );

  it("keeps an explicit provider identifier", () => {
    expect(matchIdForPlayerStatsSource("footywire", { matchId: "FW_11193" })).toBe("FW_11193");
  });
});

describe("resolveMatchId", () => {
  it.effect("returns matchIdArg unchanged when present (no fetch needed)", () => {
    const log = requestLog();

    return Effect.gen(function* () {
      const result = yield* resolveMatchId({
        matchIdArg: "CD_M20250140101",
        source: "afl-api",
        competition: "AFLM",
        season: 2025,
        round: 1,
      });

      expect(result).toEqual({ matchId: "CD_M20250140101" });
      expect(result?.participants).toBeUndefined();
      expect(log.urls).toEqual([]);
    }).pipe(Effect.provide(offlineAflApi(log)));
  });

  it.effect("returns matchIdArg even when matchArg is also given (matchIdArg wins)", () =>
    Effect.gen(function* () {
      const result = yield* resolveMatchId({
        matchIdArg: "CD_M20250140102",
        matchArg: "Carlton",
        source: "afl-api",
        competition: "AFLM",
        season: 2025,
        round: 1,
      });

      expect(result?.matchId).toBe("CD_M20250140102");
    }).pipe(Effect.provide(offlineAflApi())),
  );

  it.effect("rejects malformed --match-id with a clear error (#95)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        resolveMatchId({
          matchIdArg: "BAD_ID",
          source: "afl-api",
          competition: "AFLM",
          season: 2025,
          round: 1,
        }),
      );

      expect(error.message).toMatch(/Invalid match ID "BAD_ID" for afl-api/);
    }).pipe(Effect.provide(offlineAflApi())),
  );

  it.effect.each([
    ["footywire", "FW_11193"],
    ["afl-tables", "AT_111620240307"],
    ["fryzigg", "10001"],
  ] as const)("accepts a valid %s identifier without fetching", ([source, matchId]) => {
    const log = requestLog();

    return Effect.gen(function* () {
      const result = yield* resolveMatchId({
        source,
        matchIdArg: matchId,
        competition: "AFLM",
        season: 2025,
        round: 1,
      });

      expect(result).toEqual({ matchId });
      expect(log.urls).toEqual([]);
    }).pipe(Effect.provide(offlineAflApi(log)));
  });

  it.effect("returns undefined when neither matchIdArg nor matchArg is given", () =>
    Effect.gen(function* () {
      const result = yield* resolveMatchId({
        competition: "AFLM",
        source: "afl-api",
        season: 2025,
        round: 1,
      });

      expect(result).toBeUndefined();
    }).pipe(Effect.provide(offlineAflApi())),
  );

  it.effect("fails when matchArg is given without round (precondition)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        resolveMatchId({
          matchArg: "Carlton",
          source: "afl-api",
          competition: "AFLM",
          season: 2025,
          round: undefined,
        }),
      );

      expect(error.message).toMatch(/--match requires --round/);
    }).pipe(Effect.provide(offlineAflApi())),
  );

  it.effect("does not fail when round is given but matchArg is missing", () =>
    Effect.gen(function* () {
      const result = yield* resolveMatchId({
        competition: "AFLM",
        source: "afl-api",
        season: 2025,
        round: undefined,
      });

      expect(result).toBeUndefined();
    }).pipe(Effect.provide(offlineAflApi())),
  );

  it.effect("resolves a team name to the round's match and its participants", () =>
    Effect.gen(function* () {
      const result = yield* resolveMatchId({
        matchArg: "Carlton",
        source: "footywire",
        competition: "AFLM",
        season: 2025,
        round: 1,
      });

      expect(result).toEqual({
        matchId: "CD_M20250140101",
        participants: { homeTeam: "Richmond", awayTeam: "Carlton" },
      });
    }).pipe(Effect.provide(roundOneAflApi)),
  );
});
