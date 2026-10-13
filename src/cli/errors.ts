/**
 * CLI-only tagged errors.
 */

import { Schema } from "effect";

/** Invalid command-line usage: bad flag values, conflicting flags, unknown flags. */
export class CliUsageError extends Schema.TaggedError<CliUsageError>()("CliUsageError", {
  message: Schema.String,
}) {}
