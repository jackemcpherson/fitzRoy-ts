/**
 * AEST/AEDT-aware date parsing and formatting utilities.
 *
 * All functions use only Web Standard APIs (Date, Intl.DateTimeFormat).
 * No Node.js built-ins or third-party date libraries.
 *
 * @module
 */

/**
 * Parse a UTC ISO 8601 string from the AFL API into a Date.
 *
 * The AFL API returns dates like `"2024-03-14T06:20:00.000Z"` or
 * `"2024-03-14T06:20:00Z"`.
 *
 * @param iso - A UTC ISO 8601 date string
 * @returns A Date object, or null if parsing fails
 *
 * @example
 * ```ts
 * parseAflApiDate("2024-03-14T06:20:00.000Z")
 * // => Date(2024-03-14T06:20:00.000Z)
 * ```
 */
export function parseAflApiDate(iso: string): Date | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Parse a date string from FootyWire into a Date.
 *
 * FootyWire uses formats like:
 * - `"Sat 16 Mar 2024"` (day-of-week, day, month-abbrev, year)
 * - `"16 Mar 2024"` (day, month-abbrev, year)
 * - `"16-Mar-2024"` (day-month-year with hyphens)
 * - `"Thu 13 Mar 7:30pm"` (day-of-week, day, month, time — no year)
 * - `"13 Mar"` (day, month — no year)
 *
 * @param dateStr - A FootyWire date string
 * @param defaultYear - Year to use when the string lacks one (e.g. fixture pages)
 * @returns A Date object (UTC), or null if parsing fails
 *
 * @example
 * ```ts
 * parseFootyWireDate("Sat 16 Mar 2024")
 * // => Date(2024-03-16T00:00:00.000Z)
 *
 * parseFootyWireDate("Thu 13 Mar 7:30pm", 2025)
 * // => Date(2025-03-13T09:30:00.000Z) — time stored as AEST offset from UTC
 * ```
 */
export function parseFootyWireDate(dateStr: string, defaultYear?: number): Date | null {
  const trimmed = dateStr.trim();
  if (trimmed === "") {
    return null;
  }

  // Strip optional leading day-of-week (e.g. "Sat ", "Sunday ")
  const withoutDow = trimmed.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+/i, "");

  // Normalise hyphens to spaces: "16-Mar-2024" -> "16 Mar 2024"
  const normalised = withoutDow.replace(/-/g, " ");

  // Try "DD MMM YYYY" (with year)
  const fullMatch = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(normalised);
  if (fullMatch) {
    const [, dayStr, monthStr, yearStr] = fullMatch;
    if (dayStr && monthStr && yearStr) {
      return buildUtcDate(Number.parseInt(yearStr, 10), monthStr, Number.parseInt(dayStr, 10));
    }
  }

  // Try "DD MMM" with optional time suffix (e.g. "13 Mar 7:30pm", "13 Mar")
  const shortMatch = /^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{1,2}):(\d{2})(am|pm))?$/i.exec(normalised);
  if (shortMatch && defaultYear != null) {
    const [, dayStr, monthStr, hourStr, minStr, ampm] = shortMatch;
    if (!dayStr || !monthStr) return null;

    const monthIndex = MONTH_ABBREV_TO_INDEX.get(monthStr.toLowerCase());
    if (monthIndex === undefined) return null;

    const day = Number.parseInt(dayStr, 10);

    const hasTime = hourStr && minStr && ampm;
    if (!hasTime) {
      return buildUtcDate(defaultYear, monthStr, day);
    }

    let aestHours = Number.parseInt(hourStr, 10);
    const minutes = Number.parseInt(minStr, 10);
    if (ampm.toLowerCase() === "pm" && aestHours < 12) aestHours += 12;
    if (ampm.toLowerCase() === "am" && aestHours === 12) aestHours = 0;

    const date = melbourneLocalToUtc(defaultYear, monthIndex, day, aestHours, minutes);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  return null;
}

/**
 * Parse a date string from AFL Tables into a Date.
 *
 * AFL Tables uses formats like:
 * - `"16-Mar-2024"` (DD-Mon-YYYY)
 * - `"Sat 16-Mar-2024"` (Dow DD-Mon-YYYY)
 * - `"16 Mar 2024"` (DD Mon YYYY)
 *
 * For very old historical matches, dates may be partial (e.g. just a year),
 * which are not supported and return null.
 *
 * @param dateStr - An AFL Tables date string
 * @returns A Date object (midnight UTC), or null if parsing fails
 *
 * @example
 * ```ts
 * parseAflTablesDate("16-Mar-2024")
 * // => Date(2024-03-16T00:00:00.000Z)
 * ```
 */
export function parseAflTablesDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (trimmed === "") {
    return null;
  }

  // Strip optional leading day-of-week
  const withoutDow = trimmed.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+/i, "");

  // Normalise separators to spaces
  const normalised = withoutDow.replace(/[-/]/g, " ");

  // Try "DD MMM YYYY"
  const dmy = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(normalised);
  if (dmy) {
    const [, dayStr, monthStr, yearStr] = dmy;
    if (dayStr && monthStr && yearStr) {
      return buildUtcDate(Number.parseInt(yearStr, 10), monthStr, Number.parseInt(dayStr, 10));
    }
  }

  // Try "MMM DD YYYY" (sometimes seen in AFL Tables)
  const mdy = /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/.exec(normalised);
  if (mdy) {
    const [, monthStr, dayStr, yearStr] = mdy;
    if (dayStr && monthStr && yearStr) {
      return buildUtcDate(Number.parseInt(yearStr, 10), monthStr, Number.parseInt(dayStr, 10));
    }
  }

  return null;
}

/**
 * Format a Date as an AEST/AEDT-aware display string.
 *
 * Uses `Intl.DateTimeFormat` with the `"Australia/Melbourne"` timezone,
 * which automatically handles AEST (UTC+10) and AEDT (UTC+11) transitions.
 *
 * @param date - The Date to format
 * @returns A formatted string like `"Thu 14 Mar 2024 5:20 PM AEDT"`
 *
 * @example
 * ```ts
 * toAestString(new Date("2024-03-14T06:20:00.000Z"))
 * // => "Thu 14 Mar 2024 5:20 PM AEDT"
 * ```
 */
export function toAestString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  return formatter.format(date);
}

/**
 * Resolve the default season for a competition when none is provided.
 *
 * AFLM uses the current calendar year. AFLW seasons run ahead of the
 * calendar year (e.g. the "2025" AFLW season starts in late 2024/early 2025),
 * so the default is the previous year.
 *
 * @param competition - Competition code, defaults to "AFLM".
 * @returns The default season year.
 */
export function resolveDefaultSeason(competition: "AFLM" | "AFLW" = "AFLM"): number {
  const year = new Date().getFullYear();
  return competition === "AFLW" ? year - 1 : year;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Month abbreviation (lowercase) to zero-based month index. */
const MONTH_ABBREV_TO_INDEX: ReadonlyMap<string, number> = new Map([
  ["jan", 0],
  ["feb", 1],
  ["mar", 2],
  ["apr", 3],
  ["may", 4],
  ["jun", 5],
  ["jul", 6],
  ["aug", 7],
  ["sep", 8],
  ["oct", 9],
  ["nov", 10],
  ["dec", 11],
  ["january", 0],
  ["february", 1],
  ["march", 2],
  ["april", 3],
  ["june", 5],
  ["july", 6],
  ["august", 7],
  ["september", 8],
  ["october", 9],
  ["november", 10],
  ["december", 11],
]);

/**
 * Convert a Melbourne local time to a UTC Date, correctly handling both
 * AEST (UTC+10) and AEDT (UTC+11) via Intl.DateTimeFormat.
 */
function melbourneLocalToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number,
): Date {
  // First guess: AEST (UTC+10) — covers most of the AFL season
  const aestGuess = new Date(Date.UTC(year, monthIndex, day, hours - 10, minutes));

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(aestGuess);

  const getNum = (type: string) => Number(parts.find((p) => p.type === type)?.value);

  if (getNum("day") === day && getNum("hour") === hours % 24) {
    return aestGuess;
  }

  // AEDT (UTC+11)
  return new Date(Date.UTC(year, monthIndex, day, hours - 11, minutes));
}

function buildUtcDate(year: number, monthStr: string, day: number): Date | null {
  const monthIndex = MONTH_ABBREV_TO_INDEX.get(monthStr.toLowerCase());
  if (monthIndex === undefined) {
    return null;
  }

  const date = new Date(Date.UTC(year, monthIndex, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}
