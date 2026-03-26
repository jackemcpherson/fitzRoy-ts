/**
 * CSV output formatter — outputs data as CSV with a header row.
 *
 * Properly escapes fields containing commas, quotes, or newlines.
 */

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Format an array of flat objects as CSV with a header row.
 */
export function formatCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const firstRow = data[0];
  if (!firstRow) return "";

  const headers = Object.keys(firstRow);
  const lines: string[] = [headers.map(escapeField).join(",")];

  for (const row of data) {
    const values = headers.map((h) => escapeField(toStringValue(row[h])));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}
