/** Assertion helpers for CLI validators that return `Result`. */

import { Result } from "effect";
import type { Validated } from "../../src/cli/validation";

/** The usage-error message of a failed validation, or `undefined` on success. */
export function failureMessage<A>(result: Validated<A>): string | undefined {
  return Result.isFailure(result) ? result.failure.message : undefined;
}
