import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SourceRegistry } from "../../../src/sources/adapters/index";
import { FRYZIGG_SNAPSHOTS } from "../../../src/sources/fryzigg-snapshots";
import { fixtureFitzroy, type Registries } from "../../support/services";

/** Run assertions against the registries `SourceRegistryLive` builds. */
function withRegistries(assert: (registries: Registries) => void) {
  return () =>
    SourceRegistry.use((registries) => Effect.sync(() => assert(registries))).pipe(
      Effect.provide(fixtureFitzroy()),
    );
}

describe("source-adapter registry", () => {
  describe("Match registrations", () => {
    it.effect(
      "registers afl-api, footywire, afl-tables, and squiggle",
      withRegistries(({ match: matchRegistry }) => {
        expect([...matchRegistry.list()].sort()).toEqual([
          "afl-api",
          "afl-tables",
          "footywire",
          "squiggle",
        ]);
      }),
    );
    it.effect(
      "does not register fryzigg (no match data)",
      withRegistries(({ match: matchRegistry }) => {
        expect(matchRegistry.get("fryzigg")).toBeUndefined();
      }),
    );
    it.effect(
      "each adapter has a non-empty coverage map",
      withRegistries(({ match: matchRegistry }) => {
        for (const id of matchRegistry.list()) {
          const adapter = matchRegistry.get(id);
          expect(adapter).toBeDefined();
          expect(adapter?.coverage.size).toBeGreaterThan(0);
        }
      }),
    );
  });

  describe("PlayerStats registrations", () => {
    it.effect(
      "registers afl-api, footywire, afl-tables, and fryzigg",
      withRegistries(({ playerStats: playerStatsRegistry }) => {
        expect([...playerStatsRegistry.list()].sort()).toEqual([
          "afl-api",
          "afl-tables",
          "footywire",
          "fryzigg",
        ]);
      }),
    );
    it.effect(
      "does not register squiggle (no player-level data)",
      withRegistries(({ playerStats: playerStatsRegistry }) => {
        expect(playerStatsRegistry.get("squiggle")).toBeUndefined();
      }),
    );
  });

  describe("TeamStats registrations", () => {
    it.effect(
      "registers footywire and afl-tables only",
      withRegistries(({ teamStats: teamStatsRegistry }) => {
        expect([...teamStatsRegistry.list()].sort()).toEqual(["afl-tables", "footywire"]);
      }),
    );
    it.effect(
      "does not register afl-api (no team-stats endpoint)",
      withRegistries(({ teamStats: teamStatsRegistry }) => {
        expect(teamStatsRegistry.get("afl-api")).toBeUndefined();
      }),
    );
  });

  describe("Squad registrations", () => {
    it.effect(
      "registers afl-api, footywire, and afl-tables",
      withRegistries(({ squad: squadRegistry }) => {
        expect([...squadRegistry.list()].sort()).toEqual(["afl-api", "afl-tables", "footywire"]);
      }),
    );
  });

  describe("Lineup registrations", () => {
    it.effect(
      "registers afl-api only",
      withRegistries(({ lineup: lineupRegistry }) => {
        expect(lineupRegistry.list()).toEqual(["afl-api"]);
      }),
    );
  });

  describe("Ladder registrations", () => {
    it.effect(
      "registers afl-api, afl-tables (computed), and squiggle",
      withRegistries(({ ladder: ladderRegistry }) => {
        expect([...ladderRegistry.list()].sort()).toEqual(["afl-api", "afl-tables", "squiggle"]);
      }),
    );
  });

  describe("AFL API coverage", () => {
    it.effect(
      "covers AFLM, AFLW, VFL, and VFLW for Match",
      withRegistries(({ match: matchRegistry }) => {
        const adapter = matchRegistry.get("afl-api");
        expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(2012);
        expect(adapter?.coverage.get("AFLW")?.minSeason).toBe(2017);
        expect(adapter?.coverage.get("VFL")?.minSeason).toBe(2021);
        expect(adapter?.coverage.get("VFLW")?.minSeason).toBe(2021);
      }),
    );
  });

  describe("AFL Tables coverage", () => {
    it.effect(
      "Match coverage starts in 1897 (deepest history of any source)",
      withRegistries(({ match: matchRegistry }) => {
        const adapter = matchRegistry.get("afl-tables");
        expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(1897);
      }),
    );
    it.effect(
      "PlayerStats coverage starts in 1965 (later than match coverage)",
      withRegistries(({ playerStats: playerStatsRegistry }) => {
        const adapter = playerStatsRegistry.get("afl-tables");
        expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(1965);
      }),
    );
    it.effect(
      "Ladder coverage matches Match coverage (computed from results)",
      withRegistries(({ match: matchRegistry, ladder: ladderRegistry }) => {
        const ladder = ladderRegistry.get("afl-tables");
        const match = matchRegistry.get("afl-tables");
        expect(ladder?.coverage.get("AFLM")?.minSeason).toBe(
          match?.coverage.get("AFLM")?.minSeason,
        );
      }),
    );
  });

  describe("Fryzigg coverage", () => {
    it.effect(
      "derives both competition ranges from the reviewed snapshot manifest",
      withRegistries(({ playerStats: playerStatsRegistry }) => {
        const adapter = playerStatsRegistry.get("fryzigg");
        expect(adapter?.coverage.get("AFLM")).toEqual({
          minSeason: FRYZIGG_SNAPSHOTS.AFLM.minSeason,
          maxSeason: FRYZIGG_SNAPSHOTS.AFLM.maxSeason,
        });
        expect(adapter?.coverage.get("AFLW")).toEqual({
          minSeason: FRYZIGG_SNAPSHOTS.AFLW.minSeason,
          maxSeason: FRYZIGG_SNAPSHOTS.AFLW.maxSeason,
        });
      }),
    );
  });

  describe("defaultSource per registry", () => {
    it.effect(
      "defaults to afl-api for everything except team-stats",
      withRegistries(
        ({
          match: matchRegistry,
          playerStats: playerStatsRegistry,
          squad: squadRegistry,
          lineup: lineupRegistry,
          ladder: ladderRegistry,
        }) => {
          expect(matchRegistry.defaultSource).toBe("afl-api");
          expect(playerStatsRegistry.defaultSource).toBe("afl-api");
          expect(squadRegistry.defaultSource).toBe("afl-api");
          expect(lineupRegistry.defaultSource).toBe("afl-api");
          expect(ladderRegistry.defaultSource).toBe("afl-api");
        },
      ),
    );
    it.effect(
      "team-stats falls back to afl-tables (no AFL API endpoint exists)",
      withRegistries(({ teamStats: teamStatsRegistry }) => {
        expect(teamStatsRegistry.defaultSource).toBe("afl-tables");
      }),
    );
  });
});
