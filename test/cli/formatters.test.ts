import { describe, expect, it } from "vitest";
import { formatCsv } from "../../src/cli/formatters/csv";
import { formatJson } from "../../src/cli/formatters/json";
import { formatTable } from "../../src/cli/formatters/table";

describe("formatJson", () => {
  it("outputs valid pretty-printed JSON", () => {
    const data = [{ name: "Alice", score: 42 }];
    const output = formatJson(data);
    expect(JSON.parse(output)).toEqual(data);
    expect(output).toContain("\n"); // pretty-printed
  });
});

describe("formatCsv", () => {
  it("outputs correct headers", () => {
    const data = [{ name: "Alice", score: 42 }];
    const output = formatCsv(data);
    const lines = output.split("\n");
    expect(lines[0]).toBe("name,score");
  });

  it("outputs correct data rows", () => {
    const data = [
      { name: "Alice", score: 42 },
      { name: "Bob", score: 38 },
    ];
    const output = formatCsv(data);
    const lines = output.split("\n");
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toBe("Alice,42");
    expect(lines[2]).toBe("Bob,38");
  });

  it("escapes fields containing commas", () => {
    const data = [{ venue: "MCG, Melbourne" }];
    const output = formatCsv(data);
    const lines = output.split("\n");
    expect(lines[1]).toBe('"MCG, Melbourne"');
  });

  it("escapes fields containing double quotes", () => {
    const data = [{ name: 'The "Pies"' }];
    const output = formatCsv(data);
    const lines = output.split("\n");
    expect(lines[1]).toBe('"The ""Pies"""');
  });

  it("escapes fields containing newlines", () => {
    const data = [{ note: "line1\nline2" }];
    const output = formatCsv(data);
    expect(output).toContain('"line1\nline2"');
  });

  it("handles null and undefined values as empty strings", () => {
    const data = [{ a: null, b: undefined, c: "ok" }];
    const output = formatCsv(data);
    const lines = output.split("\n");
    expect(lines[1]).toBe(",,ok");
  });

  it("handles Date values as ISO strings", () => {
    const date = new Date("2025-03-15T14:30:00Z");
    const data = [{ date }];
    const output = formatCsv(data);
    const lines = output.split("\n");
    expect(lines[1]).toBe("2025-03-15T14:30:00.000Z");
  });

  it("returns empty string for empty array", () => {
    expect(formatCsv([])).toBe("");
  });
});

describe("formatTable", () => {
  const sampleData = [
    { name: "Collingwood", wins: 15, losses: 7, percentage: 128.5 },
    { name: "Brisbane Lions", wins: 14, losses: 8, percentage: 121.3 },
    { name: "Sydney", wins: 13, losses: 9, percentage: 115.8 },
  ];

  it("outputs header, separator, and data rows", () => {
    const output = formatTable(sampleData, { terminalWidth: 120 });
    const lines = output.split("\n");
    expect(lines.length).toBe(5); // header + separator + 3 rows
    expect(lines[0]).toContain("NAME");
    expect(lines[1]).toContain("─");
  });

  it("pads columns to equal width", () => {
    const output = formatTable(sampleData, { terminalWidth: 120 });
    const lines = output.split("\n");
    const dataLines = lines.slice(2);
    const lengths = dataLines.map((l) => l.trimEnd().length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("shows only configured columns by default", () => {
    const output = formatTable(sampleData, {
      columns: [
        { key: "name", label: "Team" },
        { key: "wins", label: "W" },
      ],
      terminalWidth: 120,
    });
    expect(output).toContain("TEAM");
    expect(output).toContain("W");
    expect(output).not.toContain("LOSSES");
    expect(output).not.toContain("PERCENTAGE");
  });

  it("shows all columns when full is true", () => {
    const output = formatTable(sampleData, {
      columns: [{ key: "name", label: "Team" }],
      full: true,
      terminalWidth: 200,
    });
    expect(output).toContain("NAME");
    expect(output).toContain("WINS");
    expect(output).toContain("LOSSES");
    expect(output).toContain("PERCENTAGE");
  });

  it("truncates columns to fit terminal width", () => {
    const output = formatTable(sampleData, { terminalWidth: 30 });
    const lines = output.split("\n");
    for (const line of lines) {
      expect(line.trimEnd().length).toBeLessThanOrEqual(30);
    }
  });

  it("returns 'No data.' for empty array", () => {
    expect(formatTable([])).toBe("No data.");
  });

  it("handles null/undefined values with dash placeholder", () => {
    const data = [{ a: "ok", b: null, c: undefined }];
    const output = formatTable(data, { terminalWidth: 120 });
    expect(output).toContain("-");
  });

  it("truncates long values with ellipsis", () => {
    const data = [{ name: "A very long team name that exceeds max width" }];
    const output = formatTable(data, {
      columns: [{ key: "name", maxWidth: 10 }],
      terminalWidth: 120,
    });
    expect(output).toContain("…");
  });

  it("formats Date values in AEST", () => {
    // 2025-03-15T14:30:00Z = 16 Mar 2025, 1:30 AM AEDT (UTC+11)
    const data = [{ date: new Date("2025-03-15T14:30:00Z") }];
    const output = formatTable(data, { terminalWidth: 120 });
    expect(output).toContain("16 Mar");
    expect(output).toContain("1:30");
  });
});
