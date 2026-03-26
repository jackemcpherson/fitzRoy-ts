import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAflTablesGameStats } from "../../src/transforms/afl-tables-player-stats";

const fixturesDir = join(__dirname, "..", "fixtures");

describe("AFL Tables player stats parsing", () => {
  const html = readFileSync(join(fixturesDir, "afltables-game-stats-2024-r1.html"), "utf-8");

  it("extracts players from both teams", () => {
    const stats = parseAflTablesGameStats(html, "111620240307", 2024, 1);
    expect(stats.length).toBeGreaterThan(40);

    // Should have players from two teams
    const teams = new Set(stats.map((s) => s.team));
    expect(teams.size).toBe(2);
  });

  it("parses player name correctly (Surname, First → First Surname)", () => {
    const stats = parseAflTablesGameStats(html, "111620240307", 2024, 1);
    const blakey = stats.find((s) => s.surname === "Blakey");
    expect(blakey).toBeDefined();
    expect(blakey?.givenName).toBe("Nick");
    expect(blakey?.displayName).toBe("Nick Blakey");
  });

  it("parses stats correctly for Nick Blakey", () => {
    const stats = parseAflTablesGameStats(html, "111620240307", 2024, 1);
    const blakey = stats.find((s) => s.surname === "Blakey");
    expect(blakey).toBeDefined();
    if (blakey) {
      expect(blakey.kicks).toBe(18);
      expect(blakey.marks).toBe(9);
      expect(blakey.handballs).toBe(8);
      expect(blakey.disposals).toBe(26);
      expect(blakey.source).toBe("afl-tables");
      expect(blakey.matchId).toBe("AT_111620240307");
    }
  });

  it("handles null/empty stat cells gracefully", () => {
    const stats = parseAflTablesGameStats(html, "111620240307", 2024, 1);
    // Amartey had empty cells for HB, GL, etc.
    const amartey = stats.find((s) => s.surname === "Amartey");
    expect(amartey).toBeDefined();
    if (amartey) {
      expect(amartey.kicks).toBe(3);
      expect(amartey.handballs).toBeNull(); // empty cell
      expect(amartey.goals).toBeNull(); // empty cell
    }
  });

  it("parses jumper numbers including sub markers", () => {
    const stats = parseAflTablesGameStats(html, "111620240307", 2024, 1);
    const blakey = stats.find((s) => s.surname === "Blakey");
    expect(blakey?.jumperNumber).toBe(22);
  });
});
