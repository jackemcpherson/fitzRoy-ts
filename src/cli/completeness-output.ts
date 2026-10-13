/** Output selection for CLI commands with partial-result envelopes. */

import {
  type CellRecord,
  type FormatOptions,
  formatJson,
  formatOutput,
  resolveFormat,
} from "./formatters/index";

/**
 * Preserve completeness metadata in JSON and emit only row data in tables or CSV.
 */
export function formatCompletenessOutput(
  envelope: CellRecord,
  rows: readonly CellRecord[],
  options: FormatOptions,
): string {
  return resolveFormat(options) === "json" ? formatJson(envelope) : formatOutput(rows, options);
}
