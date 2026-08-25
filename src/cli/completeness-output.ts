/** Output selection for CLI commands with partial-result envelopes. */

import { type FormatOptions, formatJson, formatOutput, resolveFormat } from "./formatters/index";

/**
 * Preserve completeness metadata in JSON and emit only row data in tables or CSV.
 */
export function formatCompletenessOutput(
  envelope: object,
  rows: readonly object[],
  options: FormatOptions,
): string {
  return resolveFormat(options) === "json" ? formatJson(envelope) : formatOutput(rows, options);
}
