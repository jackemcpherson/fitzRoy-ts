import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LadderResponseSchema } from "../../src/lib/validation";
import { transformLadderEntries } from "../../src/transforms/ladder";

const fixturePath = join(__dirname, "../fixtures/afl-api-ladder-2024-r10.json");

function loadEntries() {
  const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));
  const response = LadderResponseSchema.parse(raw);
  const firstLadder = response.ladders[0];
  if (!firstLadder) throw new Error("No ladder in fixture");
  return transformLadderEntries(firstLadder.entries);
}

describe("transformLadderEntries", () => {
  it("transforms fixture into complete ladder entries", () => {
    const entries = loadEntries();

    expect(entries).toHaveLength(18);

    const first = entries[0];
    expect(first).toBeDefined();
    if (!first) return;

    // Position and team
    expect(first.position).toBe(1);
    expect(first.team).toBe("Sydney Swans");

    // Win/loss/draw record
    expect(first.played).toBe(10);
    expect(first.wins).toBe(9);
    expect(first.losses).toBe(1);
    expect(first.draws).toBe(0);
    expect(first.pointsFor).toBe(1030);
    expect(first.pointsAgainst).toBe(666);
    expect(first.percentage).toBe(154.7);
    expect(first.premiershipsPoints).toBe(36);

    // Form
    expect(first.form).toBe("WWWLWWWWWW");
  });

  it("normalises team names", () => {
    const entries = loadEntries();
    const teams = entries.map((e) => e.team);
    expect(teams).toContain("Sydney Swans");
    expect(teams).toContain("GWS Giants");
    expect(teams).not.toContain("GWS GIANTS");
  });
});
