import { describe, expect, it } from "vitest";
import { formatCompletenessOutput } from "../../src/cli/completeness-output";

describe("formatCompletenessOutput", () => {
  it.each([
    [{ stats: [{ player: "One" }], failedMatchIds: ["FW_2"] }, "stats", "failedMatchIds"],
    [
      { players: [{ player: "One" }], failedTeams: ["Richmond"], scope: "all-time" },
      "players",
      "failedTeams",
    ],
    [{ awards: [{ player: "One" }], failedRounds: [2] }, "awards", "failedRounds"],
  ] as const)("preserves the %s JSON envelope", (envelope, rowsKey, failuresKey) => {
    const rows = envelope[rowsKey] as readonly object[];
    const parsed = JSON.parse(formatCompletenessOutput(envelope, rows, { format: "json" }));
    expect(parsed[rowsKey]).toEqual([{ player: "One" }]);
    expect(parsed[failuresKey]).toBeDefined();
  });

  it.each(["table", "csv"] as const)("emits only inner rows for %s output", (format) => {
    const output = formatCompletenessOutput(
      { awards: [{ player: "One" }], failedRounds: [2] },
      [{ player: "One" }],
      { format, columns: [{ key: "player", label: "Player" }] },
    );
    expect(output).toContain("One");
    expect(output).not.toContain("failedRounds");
    expect(output).not.toContain("awards");
  });
});
