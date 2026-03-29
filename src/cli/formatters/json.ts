/**
 * JSON output formatter — pretty-prints data via JSON.stringify.
 *
 * Dates are serialised in AEST/AEDT (Australia/Melbourne) so that
 * game times are human-readable for Australian audiences.
 */

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
  const offset = get("timeZoneName"); // "GMT+10" or "GMT+11"
  const sign = offset.includes("-") ? "-" : "+";
  const offsetHours = offset.replace(/[^0-9]/g, "").padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${sign}${offsetHours}:00`;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
    return dateToAestIso(new Date(value));
  }
  return value;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, jsonReplacer, 2);
}
