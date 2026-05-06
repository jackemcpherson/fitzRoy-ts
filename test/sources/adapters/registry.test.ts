import { describe, expect, it } from "vitest";
import {
  defaultSourceByCapability,
  getLadderSource,
  getLineupSource,
  getMatchSource,
  getPlayerStatsSource,
  getSquadSource,
  getTeamStatsSource,
  listLadderSources,
  listLineupSources,
  listMatchSources,
  listPlayerStatsSources,
  listSquadSources,
  listTeamStatsSources,
} from "../../../src/sources/adapters/index";

describe("source-adapter registry", () => {
  describe("Match registrations", () => {
    it("registers afl-api, footywire, afl-tables, and squiggle", () => {
      expect(listMatchSources().sort()).toEqual(["afl-api", "afl-tables", "footywire", "squiggle"]);
    });
    it("does not register fryzigg (no match data)", () => {
      expect(getMatchSource("fryzigg")).toBeUndefined();
    });
    it("each adapter has a non-empty coverage map", () => {
      for (const id of listMatchSources()) {
        const adapter = getMatchSource(id);
        expect(adapter).toBeDefined();
        expect(adapter?.coverage.size).toBeGreaterThan(0);
      }
    });
  });

  describe("PlayerStats registrations", () => {
    it("registers afl-api, footywire, afl-tables, and fryzigg", () => {
      expect(listPlayerStatsSources().sort()).toEqual([
        "afl-api",
        "afl-tables",
        "footywire",
        "fryzigg",
      ]);
    });
    it("does not register squiggle (no player-level data)", () => {
      expect(getPlayerStatsSource("squiggle")).toBeUndefined();
    });
  });

  describe("TeamStats registrations", () => {
    it("registers footywire and afl-tables only", () => {
      expect(listTeamStatsSources().sort()).toEqual(["afl-tables", "footywire"]);
    });
    it("does not register afl-api (no team-stats endpoint)", () => {
      expect(getTeamStatsSource("afl-api")).toBeUndefined();
    });
  });

  describe("Squad registrations", () => {
    it("registers afl-api only", () => {
      expect(listSquadSources()).toEqual(["afl-api"]);
    });
  });

  describe("Lineup registrations", () => {
    it("registers afl-api only", () => {
      expect(listLineupSources()).toEqual(["afl-api"]);
    });
  });

  describe("Ladder registrations", () => {
    it("registers afl-api, afl-tables (computed), and squiggle", () => {
      expect(listLadderSources().sort()).toEqual(["afl-api", "afl-tables", "squiggle"]);
    });
  });

  describe("AFL API coverage", () => {
    it("covers AFLM, AFLW, VFL, and VFLW for Match", () => {
      const adapter = getMatchSource("afl-api");
      expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(2012);
      expect(adapter?.coverage.get("AFLW")?.minSeason).toBe(2017);
      expect(adapter?.coverage.get("VFL")?.minSeason).toBe(2021);
      expect(adapter?.coverage.get("VFLW")?.minSeason).toBe(2021);
    });
  });

  describe("AFL Tables coverage", () => {
    it("Match coverage starts in 1897 (deepest history of any source)", () => {
      const adapter = getMatchSource("afl-tables");
      expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(1897);
    });
    it("PlayerStats coverage starts in 1965 (later than match coverage)", () => {
      const adapter = getPlayerStatsSource("afl-tables");
      expect(adapter?.coverage.get("AFLM")?.minSeason).toBe(1965);
    });
    it("Ladder coverage matches Match coverage (computed from results)", () => {
      const ladder = getLadderSource("afl-tables");
      const match = getMatchSource("afl-tables");
      expect(ladder?.coverage.get("AFLM")?.minSeason).toBe(match?.coverage.get("AFLM")?.minSeason);
    });
  });

  describe("defaultSourceByCapability", () => {
    it("defaults to afl-api for everything except team-stats", () => {
      expect(defaultSourceByCapability.match).toBe("afl-api");
      expect(defaultSourceByCapability.playerStats).toBe("afl-api");
      expect(defaultSourceByCapability.squad).toBe("afl-api");
      expect(defaultSourceByCapability.lineup).toBe("afl-api");
      expect(defaultSourceByCapability.ladder).toBe("afl-api");
    });
    it("team-stats falls back to afl-tables (no AFL API endpoint exists)", () => {
      expect(defaultSourceByCapability.teamStats).toBe("afl-tables");
    });
  });
});
