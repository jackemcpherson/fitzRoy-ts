import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractMatchDetails,
  mergeFootyWireStats,
  parseAdvancedStats,
  parseBasicStats,
} from "../../src/transforms/footywire-player-stats";

const fixturesDir = join(__dirname, "..", "fixtures");

function loadHtml(filename: string): string {
  return readFileSync(join(fixturesDir, filename), "utf-8");
}

describe("FootyWire player stats parsing", () => {
  const basicHtml = loadHtml("footywire-match-stats-basic-11174.html");
  const advancedHtml = loadHtml("footywire-match-stats-advanced-11174.html");

  describe("parseBasicStats", () => {
    it("extracts two teams of players from basic stats page", () => {
      const teams = parseBasicStats(basicHtml);
      expect(teams.length).toBe(2);

      // Each team should have ~23 players
      for (const [, rows] of teams) {
        expect(rows.length).toBeGreaterThan(20);
        expect(rows.length).toBeLessThan(30);
      }
    });

    it("parses core stats correctly for first player", () => {
      const teams = parseBasicStats(basicHtml);
      const firstTeamRows = teams[0]?.[1] ?? [];
      expect(firstTeamRows.length).toBeGreaterThan(0);

      // Find Isaac Heeney (should be first by disposals)
      const heeney = firstTeamRows.find((r) => r.player.includes("Heeney"));
      expect(heeney).toBeDefined();
      if (heeney) {
        expect(heeney.kicks).toBe(17);
        expect(heeney.handballs).toBe(9);
        expect(heeney.disposals).toBe(26);
        expect(heeney.marks).toBe(5);
        expect(heeney.goals).toBe(1);
        expect(heeney.behinds).toBe(1);
        expect(heeney.tackles).toBe(7);
      }
    });
  });

  describe("parseAdvancedStats", () => {
    it("extracts two teams of players from advanced stats page", () => {
      const teams = parseAdvancedStats(advancedHtml);
      expect(teams.length).toBe(2);

      for (const [, rows] of teams) {
        expect(rows.length).toBeGreaterThan(20);
      }
    });

    it("parses advanced stats correctly", () => {
      const teams = parseAdvancedStats(advancedHtml);
      const firstTeamRows = teams[0]?.[1] ?? [];

      // Advanced uses abbreviated names: "I Heeney"
      const heeney = firstTeamRows.find((r) => r.player.includes("Heeney"));
      expect(heeney).toBeDefined();
      if (heeney) {
        expect(heeney.contestedPossessions).toBe(18);
        expect(heeney.uncontestedPossessions).toBe(10);
        expect(heeney.effectiveDisposals).toBe(18);
        expect(heeney.metresGained).toBe(619);
      }
    });
  });

  describe("extractMatchDetails", () => {
    it("extracts round, venue, and teams", () => {
      const details = extractMatchDetails(basicHtml);
      expect(details.round).toContain("Round");
      expect(details.venue).toBe("SCG");
      expect(details.homeTeam).toBe("Sydney Swans");
      expect(details.awayTeam).toBe("Melbourne");
    });
  });

  describe("mergeFootyWireStats", () => {
    it("produces PlayerStats objects with both basic and advanced data", () => {
      const basicTeams = parseBasicStats(basicHtml);
      const advancedTeams = parseAdvancedStats(advancedHtml);
      const stats = mergeFootyWireStats(basicTeams, advancedTeams, "11174", 2024, 0);

      // Should have players from both teams
      expect(stats.length).toBeGreaterThan(40);

      const heeney = stats.find((s) => s.displayName.includes("Heeney"));
      expect(heeney).toBeDefined();
      if (heeney) {
        // Basic stats
        expect(heeney.kicks).toBe(17);
        expect(heeney.disposals).toBe(26);
        // Advanced stats (merged)
        expect(heeney.contestedPossessions).toBe(18);
        expect(heeney.metresGained).toBe(619);
        // Source
        expect(heeney.source).toBe("footywire");
        expect(heeney.matchId).toBe("FW_11174");
      }
    });
  });
});
