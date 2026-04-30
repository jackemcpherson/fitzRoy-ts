/**
 * AEST/AEDT-aware date parsing and formatting utilities.
 *
 * All functions use only Web Standard APIs (Date, Intl.DateTimeFormat).
 * No Node.js built-ins or third-party date libraries.
 *
 * @module
 */

/**
 * Parse any AFL date string or timestamp into a correct UTC Date.
 *
 * Accepts every format seen across AFL data sources and always returns
 * a proper UTC Date. Input format is auto-detected:
 *
 * | Input | Source | Handling |
 * |---|---|---|
 * | `1709622000` (number) | Squiggle unix timestamp | × 1000 → UTC |
 * | `"2026-03-05T08:30:00"` | AFL API `utcStartTime` (no Z) | Force UTC |
 * | `"2026-03-05T08:30:00.000Z"` | AFL API (with Z) | Parse as UTC |
 * | `"Thu 13 Mar 7:30pm"` | FootyWire (Melbourne local) | AEST/AEDT → UTC |
 * | `"16-Mar-2024"` / `"16 Mar 2024"` | AFL Tables / FootyWire | Midnight UTC |
 * | `"Sat 16 Mar 2024"` | FootyWire (day-of-week prefix) | Midnight UTC |
 *
 * @param raw - A date string or unix timestamp (seconds)
 * @param defaultYear - Year to use when the string lacks one (FootyWire fixtures)
 * @returns A Date object in UTC, or null if parsing fails
 */
export function parseDate(raw: string | number, defaultYear?: number): Date | null {
  // Unix timestamp (seconds) — Squiggle
  if (typeof raw === "number") {
    const date = new Date(raw * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // ISO 8601-ish (with or without time) — AFL API, Fryzigg, DOB fields
  // Force UTC by stripping any tz suffix and appending Z
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const stripped = trimmed.replace(/[Zz]$|[+-]\d{2}:\d{2}$/, "");
    const utc = stripped.includes("T") ? `${stripped}Z` : `${stripped}T00:00:00Z`;
    const date = new Date(utc);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Strip optional leading day-of-week (e.g. "Sat ", "Sunday ")
  const withoutDow = trimmed.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+/i, "");

  // Normalise hyphens and slashes to spaces: "16-Mar-2024" / "16/Mar/2024" -> "16 Mar 2024"
  const normalised = withoutDow.replace(/[-/]/g, " ");

  // "DD MMM YYYY" — full date, midnight UTC
  const fullMatch = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(normalised);
  if (fullMatch) {
    const [, dayStr, monthStr, yearStr] = fullMatch;
    if (dayStr && monthStr && yearStr) {
      return buildUtcDate(Number.parseInt(yearStr, 10), monthStr, Number.parseInt(dayStr, 10));
    }
  }

  // "MMM DD YYYY" — sometimes seen in AFL Tables
  const mdyMatch = /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/.exec(normalised);
  if (mdyMatch) {
    const [, monthStr, dayStr, yearStr] = mdyMatch;
    if (dayStr && monthStr && yearStr) {
      return buildUtcDate(Number.parseInt(yearStr, 10), monthStr, Number.parseInt(dayStr, 10));
    }
  }

  // "DD MMM [H:MMam/pm]" — short date with optional Melbourne local time
  const shortMatch = /^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{1,2}):(\d{2})(am|pm))?$/i.exec(normalised);
  if (shortMatch && defaultYear != null) {
    const [, dayStr, monthStr, hourStr, minStr, ampm] = shortMatch;
    if (!dayStr || !monthStr) return null;

    const monthIndex = MONTH_ABBREV_TO_INDEX.get(monthStr.toLowerCase());
    if (monthIndex === undefined) return null;

    const day = Number.parseInt(dayStr, 10);

    if (!hourStr || !minStr || !ampm) {
      return buildUtcDate(defaultYear, monthStr, day);
    }

    let hours = Number.parseInt(hourStr, 10);
    const minutes = Number.parseInt(minStr, 10);
    if (ampm.toLowerCase() === "pm" && hours < 12) hours += 12;
    if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;

    const date = melbourneLocalToUtc(defaultYear, monthIndex, day, hours, minutes);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

// Legacy aliases — delegate to parseDate
/** @deprecated Use {@link parseDate} instead. */
export function parseAflApiDate(iso: string): Date | null {
  return parseDate(iso);
}
/** @deprecated Use {@link parseDate} instead. */
export function parseAflApiMatchTime(iso: string): Date | null {
  return parseDate(iso);
}
/** @deprecated Use {@link parseDate} instead. */
export function parseFootyWireDate(dateStr: string, defaultYear?: number): Date | null {
  return parseDate(dateStr, defaultYear);
}
/** @deprecated Use {@link parseDate} instead. */
export function parseAflTablesDate(dateStr: string): Date | null {
  return parseDate(dateStr);
}

/**
 * Format a Date as an AEST/AEDT-aware display string.
 *
 * Uses `Intl.DateTimeFormat` with the `"Australia/Melbourne"` timezone,
 * which automatically handles AEST (UTC+10) and AEDT (UTC+11) transitions.
 *
 * @param date - The Date to format
 * @returns A formatted string like `"Thu 14 Mar 2024 5:20 PM AEDT"`
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
