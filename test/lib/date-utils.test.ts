import { describe, expect, it } from "vitest";
import {
  localToUtc,
  parseAflApiDate,
  parseAflApiMatchTime,
  parseAflTablesDate,
  parseDate,
  parseFootyWireDate,
  toAestString,
} from "../../src/lib/date-utils";
import { DstGapError } from "../../src/lib/errors";

describe("parseDate", () => {
  // AFL API — ISO without Z (utcStartTime)
  it("parses AFL API datetime without Z as UTC", () => {
    expect(parseDate("2026-03-05T08:30:00")?.toISOString()).toBe("2026-03-05T08:30:00.000Z");
  });

  it("parses AFL API datetime with Z as UTC", () => {
    expect(parseDate("2026-03-05T08:30:00.000Z")?.toISOString()).toBe("2026-03-05T08:30:00.000Z");
  });

  // Squiggle — unix timestamp
  it("parses unix timestamp (seconds)", () => {
    expect(parseDate(1709622000)?.toISOString()).toBe("2024-03-05T07:00:00.000Z");
  });

  // FootyWire — date only
  it("parses 'DD MMM YYYY' as midnight UTC", () => {
    expect(parseDate("16 Mar 2024")?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("parses 'DD-MMM-YYYY' as midnight UTC", () => {
    expect(parseDate("16-Mar-2024")?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  it("parses 'Sat DD MMM YYYY' as midnight UTC", () => {
    expect(parseDate("Sat 16 Mar 2024")?.toISOString()).toBe("2024-03-16T00:00:00.000Z");
  });

  // FootyWire — Melbourne local time with defaultYear
  it("parses Melbourne local time during AEDT", () => {
    expect(parseDate("Thu 13 Mar 7:30pm", 2025)?.toISOString()).toBe("2025-03-13T08:30:00.000Z");
  });

  it("parses Melbourne local time during AEST", () => {
    expect(parseDate("13 Jul 7:30pm", 2025)?.toISOString()).toBe("2025-07-13T09:30:00.000Z");
  });

  // Invalid
  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseDate("not-a-date")).toBeNull();
  });
});

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

describe("parseAflApiMatchTime", () => {
  it("parses UTC string without Z suffix correctly", () => {
    // AFL API returns UTC times without Z — must not be treated as local time
    expect(parseAflApiMatchTime("2026-03-05T08:30:00")?.toISOString()).toBe(
      "2026-03-05T08:30:00.000Z",
    );
  });

  it("parses UTC string with Z suffix correctly", () => {
    expect(parseAflApiMatchTime("2026-03-05T08:30:00Z")?.toISOString()).toBe(
      "2026-03-05T08:30:00.000Z",
    );
  });

  it("parses UTC string with milliseconds", () => {
    expect(parseAflApiMatchTime("2026-07-04T09:30:00.000Z")?.toISOString()).toBe(
      "2026-07-04T09:30:00.000Z",
    );
  });

  it("strips timezone offset if present", () => {
    expect(parseAflApiMatchTime("2026-03-05T08:30:00+00:00")?.toISOString()).toBe(
      "2026-03-05T08:30:00.000Z",
    );
  });

  it("returns null for invalid input", () => {
    expect(parseAflApiMatchTime("not-a-date")).toBeNull();
    expect(parseAflApiMatchTime("")).toBeNull();
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

  it("parses time during AEDT (UTC+11) correctly", () => {
    // March 13 2025 is during AEDT — 7:30pm AEDT = 08:30 UTC
    const date = parseFootyWireDate("Thu 13 Mar 7:30pm", 2025);
    expect(date?.toISOString()).toBe("2025-03-13T08:30:00.000Z");
  });

  it("parses time during AEST (UTC+10) correctly", () => {
    // July 13 2025 is during AEST — 7:30pm AEST = 09:30 UTC
    const date = parseFootyWireDate("13 Jul 7:30pm", 2025);
    expect(date?.toISOString()).toBe("2025-07-13T09:30:00.000Z");
  });

  it("parses date-only with defaultYear", () => {
    expect(parseFootyWireDate("13 Mar", 2025)?.toISOString()).toBe("2025-03-13T00:00:00.000Z");
  });

  it("parses am time with defaultYear", () => {
    // April 1 2025 is during AEDT — 11:00am AEDT = 00:00 UTC
    const date = parseFootyWireDate("1 Apr 11:00am", 2025);
    expect(date?.toISOString()).toBe("2025-04-01T00:00:00.000Z");
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

describe("parseDate — venue-aware time parsing (#105)", () => {
  it("parses Brisbane local time (no DST) correctly during AEDT period", () => {
    // 6:40pm in Brisbane on 2024-03-08 = 08:40 UTC (Brisbane is +10 year-round).
    expect(
      parseDate("Fri 8 Mar 6:40pm", { defaultYear: 2024, venue: "Gabba" })?.toISOString(),
    ).toBe("2024-03-08T08:40:00.000Z");
  });

  it("parses Perth local time (AWST) correctly", () => {
    // 3:50pm in Perth on 2024-03-17 = 07:50 UTC (Perth is +8 year-round).
    expect(
      parseDate("Sun 17 Mar 3:50pm", { defaultYear: 2024, venue: "Optus Stadium" })?.toISOString(),
    ).toBe("2024-03-17T07:50:00.000Z");
  });

  it("parses Adelaide local time (ACDT half-hour) correctly", () => {
    // 4:10pm in Adelaide on 2024-03-15 (ACDT, +10:30) = 05:40 UTC.
    expect(
      parseDate("Fri 15 Mar 4:10pm", { defaultYear: 2024, venue: "Adelaide Oval" })?.toISOString(),
    ).toBe("2024-03-15T05:40:00.000Z");
  });

  it("falls back to Melbourne when venue is unknown", () => {
    expect(
      parseDate("Thu 13 Mar 7:30pm", {
        defaultYear: 2025,
        venue: "Some Made-Up Oval",
      })?.toISOString(),
    ).toBe("2025-03-13T08:30:00.000Z");
  });
});

describe("parseDate — ISO offsets honoured (#105 latent variant)", () => {
  it("honours an explicit +10:00 offset instead of stripping it", () => {
    expect(parseDate("2024-03-14T08:30:00+10:00")?.toISOString()).toBe("2024-03-13T22:30:00.000Z");
  });

  it("honours an explicit -05:00 offset", () => {
    expect(parseDate("2024-03-14T08:30:00-05:00")?.toISOString()).toBe("2024-03-14T13:30:00.000Z");
  });
});

describe("localToUtc (#110)", () => {
  it("converts a regular Melbourne time during AEST", () => {
    const r = localToUtc("Australia/Melbourne", 2024, 6, 13, 19, 30);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.toISOString()).toBe("2024-07-13T09:30:00.000Z");
  });

  it("converts a regular Melbourne time during AEDT", () => {
    const r = localToUtc("Australia/Melbourne", 2024, 2, 13, 19, 30);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.toISOString()).toBe("2024-03-13T08:30:00.000Z");
  });

  it("returns DstGapError for a non-existent local time during spring-forward", () => {
    // 2024-10-06 02:30 in Australia/Melbourne — DST started at 02:00,
    // jumping to 03:00, so 02:30 doesn't exist.
    const r = localToUtc("Australia/Melbourne", 2024, 9, 6, 2, 30);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBeInstanceOf(DstGapError);
      expect(r.error.timezone).toBe("Australia/Melbourne");
    }
  });

  it("converts Perth (AWST, no DST) correctly", () => {
    const r = localToUtc("Australia/Perth", 2024, 6, 13, 19, 30);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.toISOString()).toBe("2024-07-13T11:30:00.000Z");
  });

  it("converts Adelaide (ACDT half-hour) correctly", () => {
    const r = localToUtc("Australia/Adelaide", 2024, 2, 15, 16, 10);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.toISOString()).toBe("2024-03-15T05:40:00.000Z");
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
