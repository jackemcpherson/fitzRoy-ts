/**
 * CLI error formatting — converts errors into human-readable, coloured messages.
 */

import pc from "picocolors";
import { AflApiError, ScrapeError, UnsupportedSourceError, ValidationError } from "../lib/errors";

/** Format an error into a human-readable, coloured message (no stack trace). */
export function formatError(error: unknown): string {
  if (error instanceof ValidationError && error.issues) {
    const issueLines = error.issues.map((i) => `  ${pc.yellow(i.path)}: ${i.message}`);
    return `${pc.red("Validation error:")}\n${issueLines.join("\n")}`;
  }
  if (error instanceof AflApiError) {
    const status = error.statusCode ? ` (HTTP ${error.statusCode})` : "";
    return `${pc.red("AFL API error:")} ${error.message}${status}`;
  }
  if (error instanceof ScrapeError) {
    const source = error.source ? ` [${error.source}]` : "";
    return `${pc.red("Scrape error:")} ${error.message}${source}`;
  }
  if (error instanceof UnsupportedSourceError) {
    return `${pc.red("Unsupported source:")} ${error.message}`;
  }
  if (error instanceof Error) {
    return `${pc.red("Error:")} ${error.message}`;
  }
  return `${pc.red("Error:")} ${String(error)}`;
}
