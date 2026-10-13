/**
 * Shared Effect Schema primitives used across validation modules.
 *
 * Schemas here are referenced by more than one upstream sub-surface
 * (e.g. /cfs/ match items and /cfs/ player stats both reuse `statNum`
 * and the score wrappers). Keep this file small — anything specific to
 * a single upstream belongs in its own module.
 */

import { Schema, SchemaGetter } from "effect";

/**
 * An object schema that keeps undeclared keys, like Zod's `.passthrough()`.
 *
 * Upstream APIs add fields without notice. Declared fields are validated and
 * every other key is preserved as `unknown`.
 */
export function open<const Fields extends Schema.Struct.Fields>(fields: Fields) {
  return Schema.StructWithRest(Schema.Struct(fields), [
    Schema.Record(Schema.String, Schema.Unknown),
  ]);
}

/** Decode a string stat: `""`, `"-"`, and non-numeric text become `null`. */
const StatFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.NullOr(Schema.Number), {
    decode: SchemaGetter.transform((s: string) => {
      if (s === "" || s === "-") return null;
      const n = Number(s);

      return Number.isNaN(n) ? null : n;
    }),
    encode: SchemaGetter.transform((n: number | null) => (n === null ? "" : String(n))),
  }),
);

/** Decode a boolean stat as `1` or `0`. */
const StatFromBoolean = Schema.Boolean.pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform((b: boolean) => (b ? 1 : 0)),
    encode: SchemaGetter.transform((n: number) => n !== 0),
  }),
);

/** Nullable number — AFLW responses may return `null`, string-encoded, or boolean stat fields. */
export const statNum = Schema.optional(
  Schema.NullOr(Schema.Union([Schema.Number, StatFromString, StatFromBoolean])),
);

/** Schema for a goals/behinds/total score object (used in match and period scores). */
export const ScoreSchema = open({
  totalScore: Schema.Number,
  goals: Schema.Number,
  behinds: Schema.Number,
  superGoals: Schema.optional(Schema.NullOr(Schema.Number)),
});

/** Schema for a period (quarter) score entry within a match. */
export const PeriodScoreSchema = open({
  periodNumber: Schema.Number,
  score: ScoreSchema,
});

/** Schema for a team's total score (match + period breakdown). */
export const TeamScoreSchema = open({
  matchScore: ScoreSchema,
  periodScore: Schema.optional(Schema.Array(PeriodScoreSchema)),
  rushedBehinds: Schema.optional(Schema.Number),
  minutesInFront: Schema.optional(Schema.Number),
});

/** Inferred type for a score object. */
export type Score = typeof ScoreSchema.Type;

/** Inferred type for a period score. */
export type PeriodScore = typeof PeriodScoreSchema.Type;

/** Inferred type for a team score. */
export type TeamScore = typeof TeamScoreSchema.Type;
