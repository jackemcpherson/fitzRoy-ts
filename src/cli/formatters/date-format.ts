/**
 * ISO 8601 date formatting for CLI output, in a chosen IANA timezone.
 *
 * Defaults to `Australia/Melbourne` so non-Match data keeps the
 * historical AEST/AEDT behaviour. Match rows pass the per-row
 * `venueTimezone` so a Perth match displays in AWST (#109).
 */

const DEFAULT_DISPLAY_TZ = "Australia/Melbourne";

const isoFormatterCache = new Map<string, Intl.DateTimeFormat>();

function isoFormatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = isoFormatterCache.get(timeZone);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });
  isoFormatterCache.set(timeZone, fmt);
  return fmt;
}

/**
 * Format a Date as an ISO 8601 string in the given IANA timezone.
 * Defaults to `Australia/Melbourne` for compatibility.
 */
export function toVenueIso(date: Date, timeZone: string = DEFAULT_DISPLAY_TZ): string {
  const parts = isoFormatterFor(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const offset = get("timeZoneName"); // "GMT+10" / "GMT+11" / "GMT+08" / "GMT+09:30"
  const sign = offset.includes("-") ? "-" : "+";
  const digits = offset.replace(/[^0-9:]/g, "");
  const [hoursRaw, minutesRaw] = digits.split(":");
  const hours = (hoursRaw ?? "").padStart(2, "0");
  const minutes = (minutesRaw ?? "00").padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${sign}${hours}:${minutes}`;
}

/** Format a Date as an ISO 8601 string in AEST/AEDT (e.g. `2026-04-09T09:40:00+10:00`). */
export function toAestIso(date: Date): string {
  return toVenueIso(date, DEFAULT_DISPLAY_TZ);
}
