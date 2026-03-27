import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SquiggleGamesResponseSchema,
  SquiggleStandingsResponseSchema,
} from "../../src/lib/squiggle-validation";
import {
  transformSquiggleGamesToFixture,
  transformSquiggleGamesToResults,
  transformSquiggleStandings,
} from "../../src/transforms/squiggle";

const fixturesDir = join(__dirname, "..", "fixtures");

function loadJson(filename: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, filename), "utf-8"));
}

describe("Squiggle transforms", () => {
  describe("transformSquiggleGamesToResults", () => {
    it("transforms completed games with all fields", () => {
      const raw = loadJson("squiggle-games-2024-r1.json");
      const parsed = SquiggleGamesResponseSchema.parse(raw);
      const results = transformSquiggleGamesToResults(parsed.games, 2024);

      expect(results.length).toBeGreaterThan(0);

      const first = results[0];
      expect(first).toBeDefined();
      if (!first) return;

      // Identity and metadata
      expect(first.season).toBe(2024);
      expect(first.roundNumber).toBe(1);
      expect(first.source).toBe("squiggle");
      expect(first.status).toBe("Complete");
      expect(first.matchId).toMatch(/^SQ_/);
      expect(first.homeTeam).toBeTruthy();
      expect(first.awayTeam).toBeTruthy();

      // Scores and derived fields
      expect(first.homePoints).toBeGreaterThan(0);
      expect(first.awayPoints).toBeGreaterThan(0);
      expect(first.margin).toBe(first.homePoints - first.awayPoints);
      expect(first.homeGoals * 6 + first.homeBehinds).toBe(first.homePoints);
      expect(first.awayGoals * 6 + first.awayBehinds).toBe(first.awayPoints);

      // Quarter scores not provided by Squiggle
      expect(first.q1Home).toBeNull();
      expect(first.q4Away).toBeNull();
    });
  });

  describe("transformSquiggleGamesToFixture", () => {
    it("transforms games into Fixture objects", () => {
      const raw = loadJson("squiggle-games-2024-r1.json");
      const parsed = SquiggleGamesResponseSchema.parse(raw);
      const fixtures = transformSquiggleGamesToFixture(parsed.games, 2024);

      expect(fixtures.length).toBeGreaterThan(0);

      const first = fixtures[0];
      expect(first).toBeDefined();
      if (!first) return;
      expect(first.season).toBe(2024);
      expect(first.roundNumber).toBe(1);
      expect(first.matchId).toMatch(/^SQ_/);
      expect(first.venue).toBeTruthy();
      expect(first.date).toBeInstanceOf(Date);
    });
  });

  describe("transformSquiggleStandings", () => {
    it("transforms standings into 18 ranked LadderEntry objects", () => {
      const raw = loadJson("squiggle-standings-2024-r10.json");
      const parsed = SquiggleStandingsResponseSchema.parse(raw);
      const entries = transformSquiggleStandings(parsed.standings);

      expect(entries).toHaveLength(18);

      const first = entries[0];
      expect(first).toBeDefined();
      if (!first) return;
      expect(first.position).toBe(1);
      expect(first.team).toBeTruthy();
      expect(first.played).toBe(10);
      expect(first.wins).toBeGreaterThan(0);
      expect(first.premiershipsPoints).toBeGreaterThan(0);
      expect(first.percentage).toBeGreaterThan(0);

      // Verify positions are sequential
      for (let i = 1; i < entries.length; i++) {
        const current = entries[i];
        const previous = entries[i - 1];
        if (current && previous) {
          expect(current.position).toBeGreaterThan(previous.position);
        }
      }
    });
  });
});
