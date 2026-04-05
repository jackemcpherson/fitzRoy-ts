import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DataFrame } from "@jackemcpherson/rds-js";
import { isDataFrame, parseRds } from "@jackemcpherson/rds-js";
import { describe, expect, it } from "vitest";
import { transformFryziggPlayerStats } from "../../src/transforms/fryzigg-player-stats";

const fixtureBuffer = new Uint8Array(
  readFileSync(join(__dirname, "..", "fixtures", "fryzigg-sample.rds")),
);

async function loadFixture(): Promise<DataFrame> {
  const result = await parseRds(fixtureBuffer);
  if (!isDataFrame(result)) throw new Error("Fixture is not a DataFrame");
  return result;
}

describe("transformFryziggPlayerStats", () => {
  it("maps all 5 fixture rows to PlayerStats", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.length).toBe(5);
  });

  it("maps column names correctly", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });
    if (!result.success) return;

    const first = result.data[0]!;
    expect(first.matchId).toBe("10001");
    expect(first.playerId).toBe("12345");
    expect(first.givenName).toBe("Jack");
    expect(first.surname).toBe("Viney");
    expect(first.displayName).toBe("Jack Viney");
    expect(first.team).toBe("Melbourne");
    expect(first.homeTeam).toBe("Melbourne");
    expect(first.awayTeam).toBe("Carlton");
    expect(first.jumperNumber).toBe(7);
    expect(first.source).toBe("fryzigg");
    expect(first.competition).toBe("AFLM");
  });

  it("maps core stats correctly", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });
    if (!result.success) return;

    const first = result.data[0]!;
    expect(first.kicks).toBe(18);
    expect(first.handballs).toBe(12);
    expect(first.disposals).toBe(30);
    expect(first.marks).toBe(6);
    expect(first.goals).toBe(2);
    expect(first.behinds).toBe(1);
    expect(first.tackles).toBe(5);
    expect(first.freesFor).toBe(2);
    expect(first.freesAgainst).toBe(1);
    expect(first.brownlowVotes).toBe(3);
    expect(first.totalClearances).toBe(6);
    expect(first.centreClearances).toBe(3);
    expect(first.stoppageClearances).toBe(3);
  });

  it("handles NA values as null", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });
    if (!result.success) return;

    // Row 4 (index 3) is Lance Franklin — all stats are NA in fixture
    const franklin = result.data[3]!;
    expect(franklin.givenName).toBe("Lance");
    expect(franklin.kicks).toBeNull();
    expect(franklin.handballs).toBeNull();
    expect(franklin.disposals).toBeNull();
    expect(franklin.goals).toBeNull();
    expect(franklin.brownlowVotes).toBeNull();
    expect(franklin.supercoachScore).toBeNull();
  });

  it("filters by season", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, {
      competition: "AFLM",
      season: 2024,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    // 4 rows are 2024, 1 row is 2025
    expect(result.data.length).toBe(4);
    for (const stat of result.data) {
      expect(stat.season).toBe(2024);
    }
  });

  it("filters by round", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, {
      competition: "AFLM",
      season: 2024,
      round: 1,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.length).toBe(2);
    for (const stat of result.data) {
      expect(stat.roundNumber).toBe(1);
    }
  });

  it("returns empty array when no rows match filters", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, {
      competition: "AFLM",
      season: 1900,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.length).toBe(0);
  });

  it("derives season from match_date", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });
    if (!result.success) return;

    expect(result.data[0]?.season).toBe(2024);
    expect(result.data[4]?.season).toBe(2025);
  });

  it("parses date as Date object", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });
    if (!result.success) return;

    expect(result.data[0]?.date).toBeInstanceOf(Date);
  });

  it("sets unmapped fields to null", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });
    if (!result.success) return;

    const first = result.data[0]!;
    expect(first.goalAccuracy).toBeNull();
    expect(first.goalEfficiency).toBeNull();
    expect(first.shotEfficiency).toBeNull();
    expect(first.interchangeCounts).toBeNull();
    expect(first.kickEfficiency).toBeNull();
    expect(first.kickToHandballRatio).toBeNull();
  });

  it("returns error for data frame missing required columns", () => {
    const badFrame: DataFrame = { names: ["foo", "bar"], columns: [[], []] };
    const result = transformFryziggPlayerStats(badFrame, { competition: "AFLM" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toContain("missing required column");
  });

  it("sets competition from options", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLW" });
    if (!result.success) return;

    for (const stat of result.data) {
      expect(stat.competition).toBe("AFLW");
    }
  });
});
