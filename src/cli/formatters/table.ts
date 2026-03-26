/**
 * Table output formatter — hand-rolled padded column formatting.
 *
 * Truncates output to terminal width. Accepts a columns config to show
 * a subset of fields by default, with --full to show all.
 */

/** Configuration for a table column. */
export interface TableColumnConfig {
  /** The object key to display. */
  readonly key: string;
  /** Column header label. Defaults to the key. */
  readonly label?: string | undefined;
  /** Maximum column width. Defaults to 20. */
  readonly maxWidth?: number | undefined;
}

interface TableOptions {
  /** Column configs for default view. When omitted, shows all fields. */
  readonly columns?: readonly TableColumnConfig[] | undefined;
  /** Show all columns regardless of columns config. */
  readonly full?: boolean | undefined;
  /** Terminal width override (defaults to process.stdout.columns or 120). */
  readonly terminalWidth?: number | undefined;
}

function toDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (value instanceof Date) return value.toISOString().slice(0, 16).replace("T", " ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

/**
 * Format an array of flat objects as a padded column table.
 */
export function formatTable(data: Record<string, unknown>[], options: TableOptions = {}): string {
  if (data.length === 0) return "No data.";

  const firstRow = data[0];
  if (!firstRow) return "No data.";

  const termWidth = options.terminalWidth ?? process.stdout.columns ?? 120;
  const allKeys = Object.keys(firstRow);

  // Determine which columns to show
  let columns: TableColumnConfig[];
  if (options.full || !options.columns || options.columns.length === 0) {
    columns = allKeys.map((key) => ({ key }));
  } else {
    columns = [...options.columns];
  }

  // Compute column widths in a single pass over the data
  const colWidths: number[] = columns.map((col) => (col.label ?? col.key).length);
  for (const row of data) {
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (!col) continue;
      const len = toDisplayValue(row[col.key]).length;
      const current = colWidths[i];
      if (current !== undefined && len > current) {
        colWidths[i] = len;
      }
    }
  }
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const width = colWidths[i];
    if (!col || width === undefined) continue;
    colWidths[i] = Math.min(col.maxWidth ?? 30, width);
  }

  // Truncate columns to fit terminal width
  const gap = 2; // space between columns
  const visibleCols: number[] = [];
  let usedWidth = 0;
  for (let i = 0; i < columns.length; i++) {
    const colWidth = colWidths[i];
    if (colWidth === undefined) continue;
    const needed = usedWidth > 0 ? colWidth + gap : colWidth;
    if (usedWidth + needed > termWidth && visibleCols.length > 0) break;
    visibleCols.push(i);
    usedWidth += needed;
  }

  // Build header
  const headerParts = visibleCols.map((i) => {
    const col = columns[i];
    const width = colWidths[i];
    if (!col || width === undefined) return "";
    const label = (col.label ?? col.key).toUpperCase();
    return truncate(label, width).padEnd(width);
  });
  const header = headerParts.join("  ");

  // Build separator
  const separator = visibleCols
    .map((i) => {
      const width = colWidths[i];
      if (width === undefined) return "";
      return "─".repeat(width);
    })
    .join("  ");

  // Build rows
  const rows = data.map((row) => {
    const parts = visibleCols.map((i) => {
      const col = columns[i];
      const width = colWidths[i];
      if (!col || width === undefined) return "";
      const val = toDisplayValue(row[col.key]);
      return truncate(val, width).padEnd(width);
    });
    return parts.join("  ");
  });

  return [header, separator, ...rows].join("\n");
}
