/**
 * Shared AEST/AEDT date formatting for CLI output.
 *
 * Uses Intl.DateTimeFormat with "Australia/Melbourne" to automatically
 * handle AEST (UTC+10) and AEDT (UTC+11) transitions.
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

/** Format a Date as an ISO 8601 string in AEST/AEDT (e.g. `2026-04-09T09:40:00+10:00`). */
export function toAestIso(date: Date): string {
  const parts = AEST_ISO_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const offset = get("timeZoneName"); // "GMT+10" or "GMT+11"
  const sign = offset.includes("-") ? "-" : "+";
  const offsetHours = offset.replace(/[^0-9]/g, "").padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${sign}${offsetHours}:00`;
}
