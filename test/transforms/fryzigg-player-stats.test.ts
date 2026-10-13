import { Result } from "effect";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DataFrame } from "@jackemcpherson/rds-js";
import { isDataFrame, parseRds } from "@jackemcpherson/rds-js";
import { describe, expect, it } from "vite-plus/test";
import { transformFryziggPlayerStats } from "../../src/transforms/fryzigg-player-stats";

const fixtureBuffer = new Uint8Array(
  readFileSync(join(__dirname, "..", "fixtures", "fryzigg-sample.rds")),
);

async function loadFixture(): Promise<DataFrame> {
  const result = await parseRds(fixtureBuffer);

  if (!isDataFrame(result)) throw new Error("Fixture is not a DataFrame");

  return result;
}

function frameWithoutRound(competition: "AFLM" | "AFLW"): DataFrame {
  const dateColumn = competition === "AFLW" ? "date" : "match_date";
  const teamColumn = competition === "AFLW" ? "team" : "player_team";

  return {
    names: ["match_id", dateColumn, "player_id", teamColumn],
    columns: [["1"], ["2024-03-15"], ["123"], ["Melbourne"]],
  };
}

describe("transformFryziggPlayerStats", () => {
  it("maps all 5 fixture rows to PlayerStats", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });

    expect(Result.isSuccess(result)).toBe(true);

    if (Result.isFailure(result)) return;
    expect(result.success.length).toBe(5);
  });

  it("maps column names correctly", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });

    if (Result.isFailure(result)) return;

    const first = result.success[0];
    expect(first).toBeDefined();

    if (!first) return;
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

    if (Result.isFailure(result)) return;

    const first = result.success[0];
    expect(first).toBeDefined();

    if (!first) return;
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

    if (Result.isFailure(result)) return;

    // Row 4 (index 3) is Lance Franklin — all stats are NA in fixture
    const franklin = result.success[3];
    expect(franklin).toBeDefined();

    if (!franklin) return;
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

    expect(Result.isSuccess(result)).toBe(true);

    if (Result.isFailure(result)) return;
    // 4 rows are 2024, 1 row is 2025
    expect(result.success.length).toBe(4);

    for (const stat of result.success) {
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

    expect(Result.isSuccess(result)).toBe(true);

    if (Result.isFailure(result)) return;
    expect(result.success.length).toBe(2);

    for (const stat of result.success) {
      expect(stat.roundNumber).toBe(1);
    }
  });

  it("returns empty array when no rows match filters", async () => {
    const frame = await loadFixture();

    const result = transformFryziggPlayerStats(frame, {
      competition: "AFLM",
      season: 1900,
    });

    expect(Result.isSuccess(result)).toBe(true);

    if (Result.isFailure(result)) return;
    expect(result.success.length).toBe(0);
  });

  it("derives season from match_date", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });

    if (Result.isFailure(result)) return;

    expect(result.success[0]?.season).toBe(2024);
    expect(result.success[4]?.season).toBe(2025);
  });

  it("parses date as Date object", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });

    if (Result.isFailure(result)) return;

    expect(result.success[0]?.date).toBeInstanceOf(Date);
  });

  it("sets unmapped fields to null", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLM" });

    if (Result.isFailure(result)) return;

    const first = result.success[0];
    expect(first).toBeDefined();

    if (!first) return;
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

    expect(Result.isFailure(result)).toBe(true);

    if (Result.isSuccess(result)) return;
    expect(result.failure.message).toContain("missing required column");
  });

  it.each([
    ["AFLM", "match_round"],
    ["AFLW", "fixture_round"],
  ] as const)(
    "returns an error when an explicit %s round cannot be filtered",
    (competition, roundColumn) => {
      const result = transformFryziggPlayerStats(frameWithoutRound(competition), {
        competition,
        round: 1,
      });

      expect(Result.isFailure(result)).toBe(true);

      if (Result.isSuccess(result)) return;
      expect(result.failure.message).toContain(roundColumn);
    },
  );

  it("keeps the round column optional when no round is requested", () => {
    const result = transformFryziggPlayerStats(frameWithoutRound("AFLM"), {
      competition: "AFLM",
      season: 2024,
    });

    expect(Result.isSuccess(result)).toBe(true);

    if (Result.isFailure(result)) return;
    expect(result.success).toHaveLength(1);
  });

  it("sets competition from options", async () => {
    const frame = await loadFixture();
    const result = transformFryziggPlayerStats(frame, { competition: "AFLW" });

    if (Result.isFailure(result)) return;

    for (const stat of result.success) {
      expect(stat.competition).toBe("AFLW");
    }
  });
});
