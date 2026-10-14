/**
 * CSV output formatter — outputs data as CSV with a header row.
 *
 * Properly escapes fields containing commas, quotes, or newlines.
 */

import { Cell, type CellRecord, type CellValue, classifyCell, venueTimezoneOf } from "./cell";
import { toVenueIso } from "./date-format";

function escapeField(value: string): string {
  // CSV injection defence: prefix formula-trigger first characters with '
  // so spreadsheet apps treat the cell as literal text. OWASP "Formula Injection".
  const first = value.charCodeAt(0);

  const guarded =
    first === 0x3d || // =
    first === 0x2b || // +
    first === 0x2d || // -
    first === 0x40 || // @
    first === 0x09 // \t
      ? `'${value}`
      : value;

  if (
    guarded.includes(",") ||
    guarded.includes('"') ||
    guarded.includes("\n") ||
    guarded.includes("\r")
  ) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }

  return guarded;
}

function toStringValue(value: CellValue, row: CellRecord): string {
  return Cell.$match(classifyCell(value), {
    Empty: () => "",
    // Per-row venue tz so a Perth match's date column is rendered in
    // AWST rather than AEST/AEDT (#109).
    Date: ({ date }) => toVenueIso(date, venueTimezoneOf(row)),
    Scalar: ({ scalar }) => String(scalar),
    List: ({ items }) => JSON.stringify(items),
    Record: ({ record }) => JSON.stringify(record),
  });
}

/**
 * Flatten a row's object-valued fields into dotted scalar columns so CSV
 * consumers don't see JSON-encoded objects (#95). For example,
 * `q1Home: { goals, behinds, points }` becomes `q1Home_goals`,
 * `q1Home_behinds`, `q1Home_points`.
 */
function flattenRow(row: CellRecord): CellRecord {
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, value]) =>
      Cell.$match(classifyCell(value), {
        Empty: () => [[key, value]],
        Date: () => [[key, value]],
        Scalar: () => [[key, value]],
        List: () => [[key, value]],
        Record: ({ record }) =>
          Object.entries(record).map(([nestedKey, nestedValue]) => [
            `${key}_${nestedKey}`,
            nestedValue,
          ]),
      }),
    ),
  );
}

/**
 * Format an array of flat objects as CSV with a header row. Object-valued
 * fields are flattened into dotted scalar columns; arrays are JSON-encoded
 * (their length isn't fixed so they can't be reliably flattened).
 */
export function formatCsv(data: readonly CellRecord[]): string {
  if (data.length === 0) return "";

  const flattened = data.map(flattenRow);
  const firstRow = flattened[0];

  if (!firstRow) return "";

  const headers = Object.keys(firstRow);
  const lines: string[] = [headers.map(escapeField).join(",")];

  for (const row of flattened) {
    const values = headers.map((h) => escapeField(toStringValue(row[h], row)));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}
