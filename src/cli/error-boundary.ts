/**
 * CLI error boundary — runs command programs and formats their failures
 * into human-readable, coloured messages (no stack traces).
 */

import type { ArgsDef, CommandContext, ParsedArgs } from "citty";
import { Cause, Effect, Exit, Match, Result } from "effect";
import pc from "picocolors";
import type { CliFailure } from "./errors";
import { type CliServices, cliRuntime } from "./runtime";

/** Format a non-empty optional suffix, or nothing when the value is absent or empty. */
function suffix(value: string | number | undefined, render: (present: string) => string): string {
  return value ? render(String(value)) : "";
}

/** Format an expected failure into a human-readable, coloured message. */
export const formatError: (error: CliFailure) => string = Match.type<CliFailure>().pipe(
  Match.tag("ValidationError", (error) =>
    error.issues
      ? `${pc.red("Validation error:")}\n${error.issues
          .map((i) => `  ${pc.yellow(i.path)}: ${i.message}`)
          .join("\n")}`
      : `${pc.red("Error:")} ${error.message}`,
  ),
  Match.tag(
    "AflApiError",
    (error) =>
      `${pc.red("AFL API error:")} ${error.message}${suffix(error.statusCode, (s) => ` (HTTP ${s})`)}`,
  ),
  Match.tag(
    "ScrapeError",
    (error) =>
      `${pc.red("Scrape error:")} ${error.message}${suffix(error.source, (s) => ` [${s}]`)}`,
  ),
  Match.tag("UnsupportedSourceError", (error) => `${pc.red("Unsupported source:")} ${error.message}`),
  Match.tag(
    "UnsupportedCompetitionError",
    (error) =>
      `${pc.red("Unsupported competition:")} ${error.message}${suffix(error.suggestion, (s) => `\n  ${pc.cyan("Try:")} ${s}`)}`,
  ),
  Match.tag(
    "OutOfRangeError",
    (error) =>
      `${pc.red("Season out of range:")} ${error.message}${suffix(error.suggestion, (s) => `\n  ${pc.cyan("Try:")} ${s}`)}`,
  ),
  Match.orElse((error) => `${pc.red("Error:")} ${error.message}`),
);

/**
 * Format a failed program's cause. An expected failure uses
 * {@link formatError}; a defect or interruption prints `Error: <message>`.
 */
export function formatCause(cause: Cause.Cause<CliFailure>): string {
  const failure = Cause.findError(cause);

  if (Result.isSuccess(failure)) return formatError(failure.success);
  const defect = Cause.squash(cause);

  return `${pc.red("Error:")} ${defect instanceof Error ? defect.message : String(defect)}`;
}

/**
 * Build a Citty `run` handler from a command program. The program runs on
 * the process runtime; a failure is printed to stderr without a stack trace
 * and exits with status 1.
 */
export function runCommand<A extends ArgsDef>(
  program: (args: ParsedArgs<A>) => Effect.Effect<void, CliFailure, CliServices>,
): (context: CommandContext<A>) => Promise<void> {
  return async ({ args }) => {
    const exit = await cliRuntime.runPromiseExit(Effect.suspend(() => program(args)));

    if (Exit.isFailure(exit)) {
      console.error(formatCause(exit.cause));
      process.exit(1);
    }

    await cliRuntime.dispose();
  };
}
