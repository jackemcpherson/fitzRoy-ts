import { describe, expect, it } from "vitest";
import {
  ladderRegistry,
  lineupRegistry,
  matchRegistry,
  playerStatsRegistry,
  squadRegistry,
  teamStatsRegistry,
} from "../../../src/sources/adapters/index";
import { FRYZIGG_SNAPSHOTS } from "../../../src/sources/fryzigg-snapshots";

describe("source-adapter registry", () => {
  describe("Match registrations", () => {
    it("registers afl-api, footywire, afl-tables, and squiggle", () => {
      expect([...matchRegistry.list()].sort()).toEqual([
        "afl-api",
        "afl-tables",
        "footywire",
        "squiggle",
      ]);
    });
    it("does not register fryzigg (no match data)", () => {
      expect(matchRegistry.get("fryzigg")).toBeUndefined();
    });
    it("each adapter has a non-empty coverage map", () => {
      for (const id of matchRegistry.list()) {
        const adapter = matchRegistry.get(id);
        expect(adapter).toBeDefined();
        expect(adapter?.coverage.size).toBeGreaterThan(0);
      }
    });
  });

  describe("PlayerStats registrations", () => {
    it("registers afl-api, footywire, afl-tables, and fryzigg", () => {
      expect([...playerStatsRegistry.list()].sort()).toEqual([
        "afl-api",
        "afl-tables",
        "footywire",
        "fryzigg",
      ]);
    });
    it("does not register squiggle (no player-level data)", () => {
      expect(playerStatsRegistry.get("squiggle")).toBeUndefined();
    });
  });

  describe("TeamStats registrations", () => {
    it("registers footywire and afl-tables only", () => {
      expect([...teamStatsRegistry.list()].sort()).toEqual(["afl-tables", "footywire"]);
    });
    it("does not register afl-api (no team-stats endpoint)", () => {
      expect(teamStatsRegistry.get("afl-api")).toBeUndefined();
    });
  });

  describe("Squad registrations", () => {
    it("registers afl-api, footywire, and afl-tables", () => {
      expect([...squadRegistry.list()].sort()).toEqual(["afl-api", "afl-tables", "footywire"]);
    });
  });

  describe("Lineup registrations", () => {
    it("registers afl-api only", () => {
      expect(lineupRegistry.list()).toEqual(["afl-api"]);
    });
  });

  describe("Ladder registrations", () => {
    it("registers afl-api, afl-tables (computed), and squiggle", () => {
      expect([...ladderRegistry.list()].sort()).toEqual(["afl-api", "afl-tables", "squiggle"]);
    });
  });

  describe("AFL API coverage", () => {
    it("covers AFLM, AFLW, VFL, and VFLW for Match", () => {
      const adapter = matchRegistry.get("afl-api");
      expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(2012);
      expect(adapter?.coverage.get("AFLW")?.minSeason).toBe(2017);
      expect(adapter?.coverage.get("VFL")?.minSeason).toBe(2021);
      expect(adapter?.coverage.get("VFLW")?.minSeason).toBe(2021);
    });
  });

  describe("AFL Tables coverage", () => {
    it("Match coverage starts in 1897 (deepest history of any source)", () => {
      const adapter = matchRegistry.get("afl-tables");
      expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(1897);
    });
    it("PlayerStats coverage starts in 1965 (later than match coverage)", () => {
      const adapter = playerStatsRegistry.get("afl-tables");
      expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(1965);
    });
    it("Ladder coverage matches Match coverage (computed from results)", () => {
      const ladder = ladderRegistry.get("afl-tables");
      const match = matchRegistry.get("afl-tables");
      expect(ladder?.coverage.get("AFLM")?.minSeason).toBe(match?.coverage.get("AFLM")?.minSeason);
    });
  });

  describe("Fryzigg coverage", () => {
    it("derives both competition ranges from the reviewed snapshot manifest", () => {
      const adapter = playerStatsRegistry.get("fryzigg");
      expect(adapter?.coverage.get("AFLM")).toEqual({
        minSeason: FRYZIGG_SNAPSHOTS.AFLM.minSeason,
        maxSeason: FRYZIGG_SNAPSHOTS.AFLM.maxSeason,
      });
      expect(adapter?.coverage.get("AFLW")).toEqual({
        minSeason: FRYZIGG_SNAPSHOTS.AFLW.minSeason,
        maxSeason: FRYZIGG_SNAPSHOTS.AFLW.maxSeason,
      });
    });
  });

  describe("defaultSource per registry", () => {
    it("defaults to afl-api for everything except team-stats", () => {
      expect(matchRegistry.defaultSource).toBe("afl-api");
      expect(playerStatsRegistry.defaultSource).toBe("afl-api");
      expect(squadRegistry.defaultSource).toBe("afl-api");
      expect(lineupRegistry.defaultSource).toBe("afl-api");
      expect(ladderRegistry.defaultSource).toBe("afl-api");
    });
    it("team-stats falls back to afl-tables (no AFL API endpoint exists)", () => {
      expect(teamStatsRegistry.defaultSource).toBe("afl-tables");
    });
  });
});
