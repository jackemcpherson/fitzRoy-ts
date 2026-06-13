import { describe, expect, it } from "vitest";
import { formatJson, formatOutput, type TableColumnConfig } from "../../src/cli/formatters/index";
import type { Ladder } from "../../src/types";

const sampleLadder: Ladder = {
  season: 2024,
  roundNumber: 24,
  competition: "AFLM",
  asOfMatch: null,
  entries: [
    {
      position: 1,
      team: "Sydney Swans",
      played: 23,
      wins: 17,
      losses: 5,
      draws: 1,
      pointsFor: 2400,
      pointsAgainst: 1900,
      percentage: 126.3,
      premiershipsPoints: 70,
      form: "WWLWW",
    },
  ],
};

describe("ladder JSON envelope (#101)", () => {
  it("JSON output preserves the full Ladder envelope", () => {
    const json = formatJson(sampleLadder);
    const parsed = JSON.parse(json);
    expect(parsed).toMatchObject({
      season: 2024,
      roundNumber: 24,
      competition: "AFLM",
    });
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].team).toBe("Sydney Swans");
  });

  it("table output flattens to entries[] (no envelope keys)", () => {
    const columns: TableColumnConfig[] = [
      { key: "position", label: "Pos", maxWidth: 4 },
      { key: "team", label: "Team", maxWidth: 24 },
    ];
    const table = formatOutput(sampleLadder.entries as readonly object[], {
      format: "table",
      columns,
    });
    expect(table).toContain("Sydney Swans");
    expect(table).not.toContain("competition");
    expect(table).not.toContain("AFLM");
  });

  it("CSV output flattens to entries[] (no envelope keys)", () => {
    const csv = formatOutput(sampleLadder.entries as readonly object[], {
      format: "csv",
    });
    const headers = csv.split("\n")[0] ?? "";
    expect(headers).not.toContain("season");
    expect(headers).not.toContain("competition");
    expect(headers).toContain("position");
    expect(headers).toContain("team");
  });
});
