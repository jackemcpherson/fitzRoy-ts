/**
 * Format dispatcher — selects the correct formatter based on CLI flags.
 */
import { formatCsv } from "./csv";
import { formatJson } from "./json";
import { formatTable, type TableColumnConfig } from "./table";

/** Supported output formats. */
export type OutputFormat = "table" | "json" | "csv";

export interface FormatOptions {
  /** Explicit --format flag value. */
  readonly format?: string | undefined;
  /** Shorthand --json flag. */
  readonly json?: boolean | undefined;
  /** Shorthand --csv flag. */
  readonly csv?: boolean | undefined;
  /** Whether to show all columns in table mode. */
  readonly full?: boolean | undefined;
  /** Column config for table mode (subset of fields to show by default). */
  readonly columns?: readonly TableColumnConfig[] | undefined;
}

/**
 * Resolve which output format to use based on flags and TTY status.
 *
 * Priority: --json > --csv > --format > TTY detection (non-TTY defaults to JSON).
 */
export function resolveFormat(options: FormatOptions): OutputFormat {
  if (options.json) return "json";
  if (options.csv) return "csv";
  if (options.format === "json" || options.format === "csv" || options.format === "table") {
    return options.format;
  }
  // Non-TTY defaults to JSON for piping
  if (!process.stdout.isTTY) return "json";
  return "table";
}

/**
 * Format data according to the resolved output format.
 */
export function formatOutput(data: readonly object[], options: FormatOptions): string {
  const rows = data as Record<string, unknown>[];
  const format = resolveFormat(options);
  switch (format) {
    case "json":
      return formatJson(rows);
    case "csv":
      return formatCsv(rows);
    case "table":
      return formatTable(rows, {
        columns: options.columns,
        full: options.full ?? false,
      });
  }
}

export { formatCsv } from "./csv";
export { formatJson } from "./json";
export { formatTable, type TableColumnConfig } from "./table";
