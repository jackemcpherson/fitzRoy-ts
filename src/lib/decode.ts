/**
 * Boundary decoding with Effect Schema.
 *
 * Every upstream payload passes through {@link decodeWith} once at the source
 * boundary. Domain code then trusts the decoded types.
 */

import { Result as EffectResult, Schema } from "effect";
import { err, ok, type Result } from "./result";

/**
 * Build a decoder for an upstream payload.
 *
 * The decoder reports every issue (`errors: "all"`) and returns the formatted
 * Schema error message on failure.
 *
 * @param schema - The schema that describes the payload.
 * @returns A function that decodes an unknown value into the schema's type.
 */
export function decodeWith<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
): (input: unknown) => Result<S["Type"], string> {
  const decode = Schema.decodeUnknownResult(schema, { errors: "all" });

  return (input) => {
    const decoded = decode(input);

    return EffectResult.isSuccess(decoded) ? ok(decoded.success) : err(decoded.failure.message);
  };
}
