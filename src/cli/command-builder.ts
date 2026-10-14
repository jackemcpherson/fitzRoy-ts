/**
 * Command builder that owns the per-command boilerplate.
 *
 * Each fitzroy CLI command does the same work shape:
 *   1. Validate raw flags into typed args
 *   2. Show a spinner while fetching from the library
 *   3. Fail on a library error so the error boundary handles it uniformly
 *   4. Print a one-line summary
 *   5. Format the data via the format dispatcher (json/csv/table)
 *
 * `defineFitzroyCommand` packages those steps so each command file becomes
 * a thin config: name + flags + a single `run` program that returns data.
 */

import { type ArgsDef, type CommandDef, defineCommand, type ParsedArgs } from "citty";
import { Effect, Result } from "effect";
import { runCommand } from "./error-boundary";
import type { CliFailure } from "./errors";
import type { OUTPUT_FLAGS } from "./flags";
import { type CellRecord, formatOutput, type TableColumnConfig } from "./formatters/index";
import type { CliServices } from "./runtime";
import { showSummary, withSpinner } from "./ui";
import { usage, type Validated, validateFormat } from "./validation";

/**
 * Fail if `process.argv` contains any `--flag` or `-x` token that isn't a
 * declared flag (or alias) on the given command args definition.
 *
 * Citty silently accepts unknown flags by default; this helper closes the
 * gap so e.g. `awards --source X` errors instead of running with X dropped.
 * Run after `resolveAliases` (so short tokens have already been rewritten).
 */
export function rejectUnknownFlags(argsDef: ArgsDef, rawArgv: readonly string[]): Validated<void> {
  const known = new Set<string>();

  for (const [name, def] of Object.entries(argsDef)) {
    known.add(name);

    if ("alias" in def && def.alias != null) {
      const aliases = Array.isArray(def.alias) ? def.alias : [def.alias];

      for (const a of aliases) known.add(a);
    }
  }

  for (const tok of rawArgv) {
    if (!tok.startsWith("-")) continue;

    if (tok === "--" || tok === "-") continue;

    // Negative numbers (e.g. `--limit -3` → value `-3`) are not flags.
    if (!tok.startsWith("--") && /^-\d/.test(tok)) continue;
    const stripped = tok.startsWith("--") ? tok.slice(2) : tok.slice(1);
    const flagName = stripped.split("=")[0];

    if (flagName == null || flagName === "") continue;

    if (!known.has(flagName)) {
      const validList = [...known].sort().join(", ");

      return usage(`Unknown flag: "${tok}". Valid flags for this command: ${validList}`);
    }
  }

  return Result.void;
}

/** What the builder asks the command to provide. */
export interface FitzroyCommandConfig<A extends ArgsDef, TRow extends CellRecord> {
  /** Citty meta block (name, description). */
  readonly meta: { readonly name: string; readonly description: string };
  /** Citty args definition (use the shared FLAGs, including `OUTPUT_FLAGS`). */
  readonly args: A;
  /** Default columns shown in table mode. */
  readonly columns: readonly TableColumnConfig[];
  /** Spinner message shown while `run` executes. */
  readonly spinner?: string | undefined;
  /**
   * Validate-and-fetch program. Receives the parsed Citty args. Should
   * validate inputs, build the library query, and call the library. A
   * failure reaches the error boundary; the rows are formatted.
   */
  readonly run: (args: ParsedArgs<A>) => Effect.Effect<readonly TRow[], CliFailure, CliServices>;
  /**
   * Optional one-line summary printed before the formatted output.
   * Receives the data and original args.
   */
  readonly summary?: (data: readonly TRow[], args: ParsedArgs<A>) => string;
}

/** Build a Citty command from a fitzroy config. */
export function defineFitzroyCommand<
  const A extends ArgsDef & typeof OUTPUT_FLAGS,
  TRow extends CellRecord,
>(config: FitzroyCommandConfig<A, TRow>): CommandDef<A> {
  return defineCommand<A>({
    meta: config.meta,
    args: config.args,
    run: runCommand<A>((args) =>
      Effect.gen(function* () {
        yield* Effect.fromResult(rejectUnknownFlags(config.args, process.argv));
        // SAFETY: `A` extends `typeof OUTPUT_FLAGS`, so Citty parsed these four
        // flags with exactly the OUTPUT_FLAGS definitions.
        const output = args as ParsedArgs<typeof OUTPUT_FLAGS>;
        const format = yield* Effect.fromResult(validateFormat(output.format));

        const data = yield* withSpinner(
          config.spinner ?? `Fetching ${config.meta.name}…`,
          config.run(args),
        );

        if (config.summary) {
          showSummary(config.summary(data, args));
        }

        console.log(
          formatOutput(data, {
            json: output.json,
            csv: output.csv,
            format,
            full: output.full,
            columns: config.columns,
          }),
        );
      }),
    ),
  });
}
