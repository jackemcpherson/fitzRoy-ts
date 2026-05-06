/**
 * Command builder that owns the per-command boilerplate.
 *
 * Each fitzroy CLI command does the same work shape:
 *   1. Validate raw flags into typed args
 *   2. Show a spinner while fetching from the library
 *   3. Throw on Result.err so the error boundary handles it uniformly
 *   4. Print a one-line summary
 *   5. Format the data via the format dispatcher (json/csv/table)
 *
 * `defineFitzroyCommand` packages those steps so each command file becomes
 * a thin config: name + flags + a single `run` that returns data.
 */

import { type ArgsDef, defineCommand } from "citty";
import type { Result } from "../lib/result";
import { withErrorBoundary } from "./error-boundary";
import { type FormatOptions, formatOutput, type TableColumnConfig } from "./formatters/index";
import { showSummary, withSpinner } from "./ui";
import { validateFormat } from "./validation";

/** A command's args object as Citty produces it (raw strings/booleans). */
type RawArgs = Record<string, unknown>;

/** What the builder asks the command to provide. */
export interface FitzroyCommandConfig<TArgs extends RawArgs, TRow extends object> {
  /** Citty meta block (name, description). */
  readonly meta: { readonly name: string; readonly description: string };
  /** Citty args definition (use the shared FLAGs). */
  readonly args: ArgsDef;
  /** Default columns shown in table mode. */
  readonly columns: readonly TableColumnConfig[];
  /** Spinner message shown while `run` executes. */
  readonly spinner?: string | undefined;
  /**
   * Validate-and-fetch step. Receives raw Citty args. Should validate
   * inputs, build the library query, call the library, and return the
   * Result. The builder unwraps it (throwing on err) and formats.
   */
  readonly run: (args: TArgs) => Promise<Result<readonly TRow[], Error>>;
  /**
   * Optional one-line summary printed before the formatted output.
   * Receives the data and original args.
   */
  readonly summary?: (data: readonly TRow[], args: TArgs) => string;
}

/** Build a Citty command from a fitzroy config. */
export function defineFitzroyCommand<TArgs extends RawArgs, TRow extends object>(
  config: FitzroyCommandConfig<TArgs, TRow>,
): ReturnType<typeof defineCommand> {
  return defineCommand({
    meta: config.meta,
    args: config.args,
    run: withErrorBoundary(async ({ args }: { args: RawArgs }) => {
      const typed = args as TArgs;
      const format = validateFormat(typed.format as string | undefined);

      const result = await withSpinner(config.spinner ?? `Fetching ${config.meta.name}…`, () =>
        config.run(typed),
      );

      if (!result.success) {
        throw result.error;
      }

      const data = result.data;

      if (config.summary) {
        showSummary(config.summary(data, typed));
      }

      const formatOptions: FormatOptions = {
        json: typed.json as boolean | undefined,
        csv: typed.csv as boolean | undefined,
        format,
        full: typed.full as boolean | undefined,
        columns: config.columns,
      };

      console.log(formatOutput(data as readonly object[], formatOptions));
    }),
  });
}
