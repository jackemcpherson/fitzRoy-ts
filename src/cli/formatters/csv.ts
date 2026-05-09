/**
 * CSV output formatter — outputs data as CSV with a header row.
 *
 * Properly escapes fields containing commas, quotes, or newlines.
 */

import { toAestIso } from "./date-format";

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return toAestIso(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Flatten a row's object-valued fields into dotted scalar columns so CSV
 * consumers don't see JSON-encoded objects (#95). For example,
 * `q1Home: { goals, behinds, points }` becomes `q1Home_goals`,
 * `q1Home_behinds`, `q1Home_points`.
 */
function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      value != null &&
      typeof value === "object" &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        out[`${key}_${nestedKey}`] = nestedValue;
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Format an array of flat objects as CSV with a header row. Object-valued
 * fields are flattened into dotted scalar columns; arrays are JSON-encoded
 * (their length isn't fixed so they can't be reliably flattened).
 */
export function formatCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const flattened = data.map(flattenRow);
  const firstRow = flattened[0];
  if (!firstRow) return "";

  const headers = Object.keys(firstRow);
  const lines: string[] = [headers.map(escapeField).join(",")];

  for (const row of flattened) {
    const values = headers.map((h) => escapeField(toStringValue(row[h])));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}
