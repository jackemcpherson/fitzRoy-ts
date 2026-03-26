/**
 * JSON output formatter — pretty-prints data via JSON.stringify.
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
