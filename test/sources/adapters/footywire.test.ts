import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ScrapeError } from "../../../src/lib/errors";
import { footyWirePlayerStatsSource } from "../../../src/sources/adapters/footywire";
import { FootyWireLive } from "../../../src/sources/footywire";
import { fixtureHttp, fixtureText, type Route } from "../../support/http";

const matchListHtml = fixtureText("footywire-match-list.html");

const basicStatsHtml = fixtureText("footywire-match-stats-basic-11174.html");

const advancedStatsHtml = fixtureText("footywire-match-stats-advanced-11174.html");

/**
 * The live FootyWire client serving the season match list and per-match
 * stats pages, failing the stats pages for the given match IDs.
 */
function footyWireServing(failingMids: readonly string[]) {
  const routes: Route[] = [
    ["ft_match_list", { body: matchListHtml }],
    ...failingMids.map((mid): Route => [`mid=${mid}`, { status: 404 }]),
    ["advv=Y", { body: advancedStatsHtml }],
    ["ft_match_statistics", { body: basicStatsHtml }],
  ];

  return FootyWireLive.pipe(Layer.provide(fixtureHttp(routes)));
}

describe("footyWirePlayerStatsSource (COR-03 partial-result envelope)", () => {
  it.effect("reports a failed match in failedMatchIds while the rest of the season survives", () =>
    Effect.gen(function* () {
      const source = yield* footyWirePlayerStatsSource;
      const data = yield* source.fetchPlayerStats({ source: "footywire", season: 2025 });

      expect(data.stats.length).toBeGreaterThan(0);
      expect(data.failedMatchIds).toEqual(["FW_11194"]);

      // Surviving matches still contribute stat rows.
      const matchIds = new Set(data.stats.map((s) => s.matchId));
      expect(matchIds.has("FW_11193")).toBe(true);
      expect(matchIds.has("FW_11194")).toBe(false);
    }).pipe(Effect.provide(footyWireServing(["11194"]))),
  );

  it.effect("returns empty failedMatchIds when every match succeeds", () =>
    Effect.gen(function* () {
      const source = yield* footyWirePlayerStatsSource;
      const data = yield* source.fetchPlayerStats({ source: "footywire", season: 2025 });

      expect(data.stats.length).toBeGreaterThan(0);
      expect(data.failedMatchIds).toEqual([]);
    }).pipe(Effect.provide(footyWireServing([]))),
  );

  it.effect("still fails when the match-list page itself fails", () =>
    Effect.gen(function* () {
      const source = yield* footyWirePlayerStatsSource;

      const error = yield* Effect.flip(
        source.fetchPlayerStats({ source: "footywire", season: 2025 }),
      );

      expect(error).toBeInstanceOf(ScrapeError);
    }).pipe(
      Effect.provide(
        FootyWireLive.pipe(Layer.provide(fixtureHttp([["footywire.com", { status: 503 }]]))),
      ),
    ),
  );
});
