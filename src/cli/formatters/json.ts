/**
 * JSON output formatter — pretty-prints data via JSON.stringify.
 *
 * Dates are converted to AEST/AEDT (Australia/Melbourne) strings
 * before serialisation so game times are human-readable.
 */

import { toAestIso } from "./date-format";

/** Recursively convert Date instances to AEST strings before serialisation. */
function convertDates(value: unknown): unknown {
  if (value instanceof Date) return toAestIso(value);
  if (Array.isArray(value)) return value.map(convertDates);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = convertDates(v);
    }
    return out;
  }
  return value;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(convertDates(data), null, 2);
}
