/**
 * UI helpers — spinner and summary line for CLI output.
 *
 * Wraps @clack/prompts spinner. Suppresses interactive output when stdout is not a TTY.
 */
import { spinner } from "@clack/prompts";
import pc from "picocolors";

const isTTY = process.stdout.isTTY === true;

/**
 * Run an async operation with a spinner. Suppresses spinner when not a TTY.
 *
 * @param message - Message to display while the spinner is active.
 * @param fn - Async function to execute.
 * @returns The result of the async function.
 */
export async function withSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  if (!isTTY) {
    return fn();
  }

  const s = spinner();
  s.start(message);
  try {
    const result = await fn();
    s.stop(message);
    return result;
  } catch (error) {
    s.error("Failed");
    throw error;
  }
}

/**
 * Print a summary line after data loads.
 *
 * @param message - Summary message to display (e.g. "Loaded 198 matches for 2025").
 */
export function showSummary(message: string): void {
  if (!isTTY) return;
  console.error(pc.dim(message));
}
