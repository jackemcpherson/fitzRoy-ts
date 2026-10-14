/**
 * Boundary decoding with Effect Schema.
 *
 * Every upstream JSON payload passes through {@link decodeJson} once at the
 * source boundary. Domain code then trusts the decoded types.
 */

import { Effect, Schema } from "effect";

/**
 * Build a decoder for an upstream JSON payload.
 *
 * The decoder reports every issue (`errors: "all"`) and fails with the
 * formatted Schema error message.
 *
 * @param schema - The schema that describes the payload.
 * @returns A function that decodes parsed JSON into the schema's type.
 */
export function decodeJson<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
): (json: Schema.Json) => Effect.Effect<S["Type"], string> {
  const decode = Schema.decodeUnknownEffect(schema, { errors: "all" });

  return (json) => decode(json).pipe(Effect.mapError((error) => error.message));
}
