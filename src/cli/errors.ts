/**
 * CLI-only tagged errors.
 */

import { Schema } from "effect";
import type { SourceError } from "../lib/errors";
import type { RequestError } from "../lib/http";

/** Invalid command-line usage: bad flag values, conflicting flags, unknown flags. */
export class CliUsageError extends Schema.TaggedError<CliUsageError>()("CliUsageError", {
  message: Schema.String,
}) {}

/** Every expected failure a CLI command can report. */
export type CliFailure = SourceError | CliUsageError | RequestError;
