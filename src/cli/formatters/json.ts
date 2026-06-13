/**
 * JSON output formatter — pretty-prints data via JSON.stringify.
 *
 * Dates are converted to ISO strings before serialisation so game
 * times are human-readable. Defaults to Australia/Melbourne, but
 * match rows with a non-null `venueTimezone` use the venue's IANA
 * tz so a Perth match shows AWST (#109).
 */

import { toVenueIso } from "./date-format";

/**
 * Recursively convert Date instances to ISO strings before serialisation.
 *
 * The `venueTimezone` propagated from the enclosing object overrides
 * the default Melbourne tz for any Date deeper in the tree.
 */
function convertDates(value: unknown, inheritedTz?: string): unknown {
  if (value instanceof Date) return toVenueIso(value, inheritedTz);
  if (Array.isArray(value)) return value.map((v) => convertDates(v, inheritedTz));
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const rowTz =
      typeof obj.venueTimezone === "string" && obj.venueTimezone.length > 0
        ? obj.venueTimezone
        : inheritedTz;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = convertDates(v, rowTz);
    }
    return out;
  }
  return value;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(convertDates(data), null, 2);
}
