/**
 * UI helpers — spinner and summary line for CLI output.
 *
 * Wraps @clack/prompts spinner. Suppresses interactive output when stdout is not a TTY.
 */
import { spinner } from "@clack/prompts";
import { Effect, Exit } from "effect";
import pc from "picocolors";

const isTTY = process.stdout.isTTY === true;

/**
 * Run an effect with a spinner. Suppresses the spinner when not a TTY.
 *
 * @param message - Message to display while the spinner is active.
 * @param effect - The effect to run.
 * @returns The effect, wrapped so the spinner stops when it exits.
 */
export function withSpinner<A, E, R>(
  message: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> {
  if (!isTTY) return effect;

  return Effect.suspend(() => {
    const s = spinner();
    s.start(message);

    return effect.pipe(
      Effect.onExit((exit) =>
        Effect.sync(() => (Exit.isSuccess(exit) ? s.stop(message) : s.error("Failed"))),
      ),
    );
  });
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

/**
 * Print a warning line to stderr — always shown (TTY or not), so JSON
 * consumers can capture caveats without contaminating stdout.
 *
 * @param message - Warning message (e.g. data-quality or scope caveats).
 */
export function showWarning(message: string): void {
  console.error(pc.yellow(`warning: ${message}`));
}
