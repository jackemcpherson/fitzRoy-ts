import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { fetchLineup } from "../../src/api/lineup";
import { MatchItemSchema } from "../../src/lib/validation";
import { SourceRegistryLive } from "../../src/sources/adapters/index";
import { AflApi } from "../../src/sources/afl-api";
import { fixtureText, type Route } from "../support/http";
import { fixtureFitzroy } from "../support/services";

const rosterJson = fixtureText("afl-api-match-roster-2025.json");

/** The roster's match as the single member of its season inventory. */
const seasonMember = Schema.decodeUnknownSync(MatchItemSchema)({
  match: Schema.decodeUnknownSync(Schema.Struct({ match: Schema.Unknown }))(JSON.parse(rosterJson))
    .match,
  round: { name: "Round 1", roundId: "CD_R202501401", roundNumber: 1 },
});

/** Routes answering the WMCTok POST and the matchRoster GET. */
const ROSTER_ROUTES: readonly Route[] = [
  ["WMCTok", { body: JSON.stringify({ token: "test-token" }) }],
  ["/matchRoster/full/", { body: rosterJson }],
  [/./, { body: "unexpected URL", status: 500 }],
];

/**
 * The live AFL API with the season lookup and inventory replaced, so the
 * lineup flow resolves the 2025 season without the compseason and round
 * endpoints, then fetches the roster from fixtures.
 */
const aflApiWithInventory = Layer.effect(
  AflApi,
  Effect.gen(function* () {
    const live = yield* AflApi;

    return {
      ...live,
      resolveCompSeason: () => Effect.succeed(73),
      fetchSeasonMatchItems: () => Effect.succeed([seasonMember]),
    };
  }),
);

/** Fresh, so layer memoisation does not reuse the registry inside `FitzroyLive`. */
const lineupEnvironment = Layer.fresh(SourceRegistryLive).pipe(
  Layer.provide(aflApiWithInventory),
  Layer.provide(fixtureFitzroy(ROSTER_ROUTES)),
);

describe("fetchLineup public API", () => {
  it.effect("returns a one-element Lineup array for an explicit matchId", () =>
    Effect.gen(function* () {
      const lineups = yield* fetchLineup({
        source: "afl-api",
        season: 2025,
        round: 1,
        matchId: "CD_M20250140101",
      });

      expect(lineups).toHaveLength(1);
      const lineup = lineups[0];
      expect(lineup).toBeDefined();

      if (!lineup) return;
      expect(lineup.matchId).toBe("CD_M20250140101");
      expect(lineup.season).toBe(2025);
      expect(lineup.roundNumber).toBe(1);
      expect(lineup.homeTeam).toBe("Richmond");
      expect(lineup.awayTeam).toBe("Carlton");
      expect(lineup.competition).toBe("AFLM");
      expect(lineup.source).toBe("afl-api");
      expect(Array.isArray(lineup.homePlayers)).toBe(true);
      expect(Array.isArray(lineup.awayPlayers)).toBe(true);
    }).pipe(Effect.provide(lineupEnvironment)),
  );

  it.effect("fails for non-afl-api source (footywire)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLineup({
          source: "footywire",
          season: 2025,
          round: 1,
        }),
      );

      expect(error.message).toContain("footywire does not provide lineup");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for non-afl-api source (afl-tables)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLineup({
          source: "afl-tables",
          season: 2025,
          round: 1,
        }),
      );

      expect(error.message).toContain("afl-tables does not provide lineup");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("fails for season below afl-api coverage (pre-2012)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        fetchLineup({
          source: "afl-api",
          season: 2010,
          round: 1,
        }),
      );

      expect(error.message).toContain("2010");
    }).pipe(Effect.provide(fixtureFitzroy())),
  );
});
