import { describe, expect, it } from "vitest";
import {
  parseAflApiDate,
  parseAflTablesDate,
  parseFootyWireDate,
  toAestString,
} from "../../src/lib/date-utils";

describe("parseAflApiDate", () => {
  it.each([
    ["2024-03-14T06:20:00.000Z", "2024-03-14T06:20:00.000Z"],
    ["2024-03-14T06:20:00Z", "2024-03-14T06:20:00.000Z"],
    ["2024-03-14", undefined], // valid but year-only check below
  ])("parses %s", (input, expectedIso) => {
    const date = parseAflApiDate(input);
    expect(date).toBeInstanceOf(Date);
    if (expectedIso) expect(date?.toISOString()).toBe(expectedIso);
    else expect(date?.getUTCFullYear()).toBe(2024);
  });

  it.each(["not-a-date", ""])("returns null for %j", (input) => {
    expect(parseAflApiDate(input)).toBeNull();
  });
});

describe("parseFootyWireDate", () => {
  it.each([
    ["Sat 16 Mar 2024", "2024-03-16T00:00:00.000Z"],
    ["16 Mar 2024", "2024-03-16T00:00:00.000Z"],
    ["16-Mar-2024", "2024-03-16T00:00:00.000Z"],
    ["Saturday 16 Mar 2024", "2024-03-16T00:00:00.000Z"],
    ["1 Apr 2024", "2024-04-01T00:00:00.000Z"],
    ["16 March 2024", "2024-03-16T00:00:00.000Z"],
    ["  16 Mar 2024  ", "2024-03-16T00:00:00.000Z"],
  ])("parses %j → %s", (input, expectedIso) => {
    expect(parseFootyWireDate(input)?.toISOString()).toBe(expectedIso);
  });

  it.each(["", "2024/03/16", "30 Feb 2024"])("returns null for %j (no defaultYear)", (input) => {
    expect(parseFootyWireDate(input)).toBeNull();
  });

  it("parses time with defaultYear (7:30pm AEST)", () => {
    const date = parseFootyWireDate("Thu 13 Mar 7:30pm", 2025);
    expect(date).toBeInstanceOf(Date);
    expect(date?.getUTCFullYear()).toBe(2025);
    expect(date?.getUTCMonth()).toBe(2); // March
    expect(date?.getUTCDate()).toBe(13);
  });

  it("parses date-only with defaultYear", () => {
    expect(parseFootyWireDate("13 Mar", 2025)?.toISOString()).toBe("2025-03-13T00:00:00.000Z");
  });

  it("parses am time with defaultYear", () => {
    const date = parseFootyWireDate("1 Apr 11:00am", 2025);
    expect(date).toBeInstanceOf(Date);
    expect(date?.getUTCMonth()).toBe(3); // April
  });

  it.each(["13 Mar 7:30pm", "13 Mar"])("returns null for %j without defaultYear", (input) => {
    expect(parseFootyWireDate(input)).toBeNull();
  });
});

describe("parseAflTablesDate", () => {
  it.each([
    ["16-Mar-2024", "2024-03-16T00:00:00.000Z"],
    ["Sat 16-Mar-2024", "2024-03-16T00:00:00.000Z"],
    ["16 Mar 2024", "2024-03-16T00:00:00.000Z"],
    ["16/Mar/2024", "2024-03-16T00:00:00.000Z"],
    ["8-May-1897", "1897-05-08T00:00:00.000Z"],
  ])("parses %j → %s", (input, expectedIso) => {
    expect(parseAflTablesDate(input)?.toISOString()).toBe(expectedIso);
  });

  it.each(["", "2024", "16-Xyz-2024"])("returns null for %j", (input) => {
    expect(parseAflTablesDate(input)).toBeNull();
  });
});

describe("toAestString", () => {
  it("formats AEDT (summer) correctly", () => {
    const result = toAestString(new Date("2024-03-14T06:20:00.000Z"));
    expect(result).toContain("2024");
    expect(result).toContain("Mar");
    expect(result).toContain("5:20");
    expect(result).toContain("pm");
  });

  it("formats AEST (winter) correctly", () => {
    const result = toAestString(new Date("2024-07-01T06:00:00.000Z"));
    expect(result).toContain("4:00");
    expect(result).toContain("pm");
    expect(result).toContain("Jul");
  });
});
