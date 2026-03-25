import { describe, expect, it } from "vitest";
import {
  parseAflApiDate,
  parseAflTablesDate,
  parseFootyWireDate,
  toAestString,
} from "../../src/lib/date-utils";

describe("parseAflApiDate", () => {
  it("parses a standard UTC ISO string with milliseconds", () => {
    const date = parseAflApiDate("2024-03-14T06:20:00.000Z");
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe("2024-03-14T06:20:00.000Z");
  });

  it("parses a UTC ISO string without milliseconds", () => {
    const date = parseAflApiDate("2024-03-14T06:20:00Z");
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe("2024-03-14T06:20:00.000Z");
  });

  it("parses a date-only ISO string", () => {
    const date = parseAflApiDate("2024-03-14");
    expect(date).toBeInstanceOf(Date);
    expect(date?.getUTCFullYear()).toBe(2024);
  });

  it("returns null for invalid strings", () => {
    expect(parseAflApiDate("not-a-date")).toBeNull();
    expect(parseAflApiDate("")).toBeNull();
  });
});

describe("parseFootyWireDate", () => {
  it("parses 'Sat 16 Mar 2024' format", () => {
    const date = parseFootyWireDate("Sat 16 Mar 2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("parses '16 Mar 2024' without day-of-week", () => {
    const date = parseFootyWireDate("16 Mar 2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("parses '16-Mar-2024' hyphenated format", () => {
    const date = parseFootyWireDate("16-Mar-2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("parses full day-of-week names", () => {
    const date = parseFootyWireDate("Saturday 16 Mar 2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("handles single-digit day", () => {
    const date = parseFootyWireDate("1 Apr 2024");
    expect(date?.toISOString()).toBe("2024-04-01T00:00:00.000Z");
  });

  it("handles full month names", () => {
    const date = parseFootyWireDate("16 March 2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("handles whitespace around the string", () => {
    const date = parseFootyWireDate("  16 Mar 2024  ");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("returns null for empty string", () => {
    expect(parseFootyWireDate("")).toBeNull();
  });

  it("returns null for unrecognised format", () => {
    expect(parseFootyWireDate("2024/03/16")).toBeNull();
  });

  it("returns null for invalid date like Feb 30", () => {
    expect(parseFootyWireDate("30 Feb 2024")).toBeNull();
  });
});

describe("parseAflTablesDate", () => {
  it("parses 'DD-Mon-YYYY' format", () => {
    const date = parseAflTablesDate("16-Mar-2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("parses 'Sat 16-Mar-2024' with day-of-week", () => {
    const date = parseAflTablesDate("Sat 16-Mar-2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("parses 'DD Mon YYYY' with spaces", () => {
    const date = parseAflTablesDate("16 Mar 2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("parses slash-separated dates", () => {
    const date = parseAflTablesDate("16/Mar/2024");
    expect(date?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("handles historical dates from 1897", () => {
    const date = parseAflTablesDate("8-May-1897");
    expect(date?.toISOString()).toBe("1897-05-08T00:00:00.000Z");
  });

  it("returns null for empty string", () => {
    expect(parseAflTablesDate("")).toBeNull();
  });

  it("returns null for year-only string", () => {
    expect(parseAflTablesDate("2024")).toBeNull();
  });

  it("returns null for invalid month", () => {
    expect(parseAflTablesDate("16-Xyz-2024")).toBeNull();
  });
});

describe("toAestString", () => {
  it("formats a date in AEST/AEDT timezone", () => {
    // March 14 is during AEDT (UTC+11)
    const result = toAestString(new Date("2024-03-14T06:20:00.000Z"));
    // 06:20 UTC = 17:20 AEDT
    expect(result).toContain("2024");
    expect(result).toContain("Mar");
    expect(result).toContain("14");
    expect(result).toContain("5:20");
    expect(result).toContain("pm");
  });

  it("uses AEST during winter months", () => {
    // July 1 is during AEST (UTC+10)
    const result = toAestString(new Date("2024-07-01T06:00:00.000Z"));
    // 06:00 UTC = 16:00 AEST
    expect(result).toContain("4:00");
    expect(result).toContain("pm");
    expect(result).toContain("Jul");
  });

  it("returns a non-empty string", () => {
    const result = toAestString(new Date("2024-01-01T00:00:00.000Z"));
    expect(result.length).toBeGreaterThan(0);
  });
});
