import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LadderResponseSchema } from "../../src/lib/validation";
import { transformLadderEntries } from "../../src/transforms/ladder";

const fixturePath = join(__dirname, "../fixtures/afl-api-ladder-2024-r10.json");

function loadFixture() {
  const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));
  return LadderResponseSchema.parse(raw);
}

describe("transformLadderEntries", () => {
  it("transforms fixture into 18 ladder entries", () => {
    const response = loadFixture();
    const firstLadder = response.ladders[0];
    expect(firstLadder).toBeDefined();
    const entries = transformLadderEntries(firstLadder!.entries);
    expect(entries).toHaveLength(18);
  });

  it("first entry has correct position and team", () => {
    const response = loadFixture();
    const entries = transformLadderEntries(response.ladders[0]!.entries);
    const first = entries[0];
    expect(first).toBeDefined();
    expect(first!.position).toBe(1);
    expect(first!.team).toBe("Sydney");
  });

  it("extracts wins, losses, draws, and points correctly", () => {
    const response = loadFixture();
    const entries = transformLadderEntries(response.ladders[0]!.entries);
    const first = entries[0]!;
    expect(first.played).toBe(10);
    expect(first.wins).toBe(9);
    expect(first.losses).toBe(1);
    expect(first.draws).toBe(0);
    expect(first.pointsFor).toBe(1030);
    expect(first.pointsAgainst).toBe(666);
    expect(first.percentage).toBe(154.7);
    expect(first.premiershipsPoints).toBe(36);
  });

  it("extracts form string", () => {
    const response = loadFixture();
    const entries = transformLadderEntries(response.ladders[0]!.entries);
    expect(entries[0]!.form).toBe("WWWLWWWWWW");
  });

  it("normalises team names", () => {
    const response = loadFixture();
    const entries = transformLadderEntries(response.ladders[0]!.entries);
    const teams = entries.map((e) => e.team);
    expect(teams).toContain("Sydney");
    expect(teams).not.toContain("Sydney Swans");
    expect(teams).toContain("Greater Western Sydney");
    expect(teams).not.toContain("GWS GIANTS");
  });
});
