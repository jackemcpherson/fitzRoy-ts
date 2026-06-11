/**
 * Venue-tz-aware date parsing and formatting utilities.
 *
 * All functions use only Web Standard APIs (Date, Intl.DateTimeFormat).
 * No Node.js built-ins or third-party date libraries.
 *
 * @module
 */

import type { CompetitionCode } from "../types";
import { DstGapError } from "./errors";
import { err, ok, type Result } from "./result";
import { normaliseVenueName } from "./venue-mapping";
import { resolveVenueTimezone } from "./venue-timezones";

/** Default IANA timezone used when no venue/zone is supplied. */
const DEFAULT_TIMEZONE = "Australia/Melbourne";

/** Options for {@link parseDate} — venue (canonical or raw) or explicit IANA tz. */
export interface ParseDateOptions {
  /** Year to assume when the input lacks one (FootyWire fixtures). */
  defaultYear?: number;
  /** Venue name (raw or canonical) — resolves to an IANA tz via the static map. */
  venue?: string;
  /** Explicit IANA tz override (wins over `venue`). */
  timezone?: string;
}

/**
 * Parse any AFL date string or timestamp into a correct UTC Date.
 *
 * Accepts every format seen across AFL data sources and always returns
 * a proper UTC Date. Input format is auto-detected:
 *
 * | Input | Source | Handling |
 * |---|---|---|
 * | `1709622000` (number) | Squiggle unix timestamp | × 1000 → UTC |
 * | `"2026-03-05T08:30:00.000Z"` | AFL API (UTC) | Parse as UTC |
 * | `"2026-03-05T08:30:00+10:00"` | ISO with offset | Honour the offset |
 * | `"Thu 13 Mar 7:30pm"` | FootyWire (venue-local) | venue tz → UTC |
 * | `"16-Mar-2024"` / `"16 Mar 2024"` | AFL Tables / FootyWire | Midnight UTC |
 * | `"Sat 16 Mar 2024"` | FootyWire (day-of-week prefix) | Midnight UTC |
 *
 * @param raw - A date string or unix timestamp (seconds)
 * @param defaultYearOrOptions - Either a year (legacy positional form) or a
 * full options object with `defaultYear`, `venue`, and/or `timezone`.
 * @returns A Date object in UTC, or null if parsing fails.
 */
export function parseDate(
  raw: string | number,
  defaultYearOrOptions?: number | ParseDateOptions,
): Date | null {
  const opts: ParseDateOptions =
    typeof defaultYearOrOptions === "number"
      ? { defaultYear: defaultYearOrOptions }
      : (defaultYearOrOptions ?? {});

  // Unix timestamp (seconds) — Squiggle
  if (typeof raw === "number") {
    const date = new Date(raw * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // ISO 8601-ish — honour the supplied offset, or assume UTC if naive.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const hasTime = trimmed.includes("T") || trimmed.includes(" ");
    const hasOffset = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed);
    let isoInput: string;
    if (hasOffset) {
      // Already explicit; let the engine honour the offset.
      isoInput = trimmed;
    } else {
      // Naive — treat as UTC (matches AFL API's `utcStartTime` convention).
      isoInput = hasTime ? `${trimmed}Z` : `${trimmed}T00:00:00Z`;
    }
    const date = new Date(isoInput);
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

  // "DD MMM [H:MMam/pm]" — short date with optional venue-local time
  const shortMatch = /^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{1,2}):(\d{2})(am|pm))?$/i.exec(normalised);
  if (shortMatch && opts.defaultYear != null) {
    const [, dayStr, monthStr, hourStr, minStr, ampm] = shortMatch;
    if (!dayStr || !monthStr) return null;

    const monthIndex = MONTH_ABBREV_TO_INDEX.get(monthStr.toLowerCase());
    if (monthIndex === undefined) return null;

    const day = Number.parseInt(dayStr, 10);

    if (!hourStr || !minStr || !ampm) {
      return buildUtcDate(opts.defaultYear, monthStr, day);
    }

    let hours = Number.parseInt(hourStr, 10);
    const minutes = Number.parseInt(minStr, 10);
    if (ampm.toLowerCase() === "pm" && hours < 12) hours += 12;
    if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;

    const tz = resolveTimezone(opts);
    const result = localToUtc(tz, opts.defaultYear, monthIndex, day, hours, minutes);
    return result.success ? result.data : null;
  }

  return null;
}

/** Resolve the IANA tz to use for a venue-local parse. */
function resolveTimezone(opts: ParseDateOptions): string {
  if (opts.timezone != null) return opts.timezone;
  if (opts.venue != null) {
    const canonical = normaliseVenueName(opts.venue);
    return resolveVenueTimezone(canonical) ?? DEFAULT_TIMEZONE;
  }
  return DEFAULT_TIMEZONE;
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
 * AFLM, VFL, and VFLW use the current calendar year. AFLW seasons run ahead
 * of the calendar year (e.g. the "2025" AFLW season starts in late 2024/early
 * 2025), so the default is the previous year.
 */
export function resolveDefaultSeason(competition: CompetitionCode = "AFLM"): number {
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
 * Convert a wall-clock time in any IANA timezone to a UTC Date.
 *
 * Returns `Result.err(DstGapError)` when the given local time is in a
 * spring-forward gap (e.g. 02:30 in `Australia/Melbourne` on the morning
 * the clocks jumped from 02:00 → 03:00). Callers can then choose to
 * skip, escalate, or roll forward — the previous behaviour silently
 * mapped gap times to the *prior* AEST instant (issue #110).
 *
 * Strategy: probe by rendering a candidate UTC against the target tz
 * (using `Intl.DateTimeFormat`); accept whichever offset round-trips.
 * Tries +0h..+14h spanning every IANA tz; covers DST and non-DST zones
 * uniformly.
 */
export function localToUtc(
  timezone: string,
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number,
): Result<Date, DstGapError> {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Sweep the plausible offset range (-14..+14h). The candidate that
  // renders back to the requested wall clock in `timezone` is correct.
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 30) {
    const candidate = new Date(
      Date.UTC(year, monthIndex, day, hours, minutes) + offsetMinutes * 60_000,
    );
    if (Number.isNaN(candidate.getTime())) continue;
    const parts = formatter.formatToParts(candidate);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const renderedHours = get("hour") % 24;
    if (
      get("year") === year &&
      get("month") === monthIndex + 1 &&
      get("day") === day &&
      renderedHours === hours % 24 &&
      get("minute") === minutes
    ) {
      return ok(candidate);
    }
  }

  return err(
    new DstGapError(
      `Local time ${formatTimestamp(year, monthIndex, day, hours, minutes)} does not exist in ${timezone} (DST spring-forward gap).`,
      timezone,
      year,
      monthIndex,
      day,
      hours,
      minutes,
    ),
  );
}

function formatTimestamp(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number,
): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${year}-${pad(monthIndex + 1)}-${pad(day)} ${pad(hours)}:${pad(minutes)}`;
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
