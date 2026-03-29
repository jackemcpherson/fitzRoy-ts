/**
 * CSV output formatter — outputs data as CSV with a header row.
 *
 * Properly escapes fields containing commas, quotes, or newlines.
 */

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const AEST_ISO_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "shortOffset",
});

function dateToAestIso(date: Date): string {
  const parts = AEST_ISO_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const offset = get("timeZoneName");
  const sign = offset.includes("-") ? "-" : "+";
  const offsetHours = offset.replace(/[^0-9]/g, "").padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${sign}${offsetHours}:00`;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return dateToAestIso(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Format an array of flat objects as CSV with a header row.
 */
export function formatCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const firstRow = data[0];
  if (!firstRow) return "";

  const headers = Object.keys(firstRow);
  const lines: string[] = [headers.map(escapeField).join(",")];

  for (const row of data) {
    const values = headers.map((h) => escapeField(toStringValue(row[h])));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}
