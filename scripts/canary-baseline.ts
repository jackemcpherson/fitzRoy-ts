import { Option, Schema } from "effect";

export type Baseline = Record<string, number>;

export type CountEvaluation =
  | { readonly status: "first-run"; readonly observed: number }
  | {
      readonly status: "accepted";
      readonly observed: number;
      readonly previous: number;
    }
  | {
      readonly status: "drift";
      readonly observed: number;
      readonly previous: number;
      readonly floor: number;
    };

const BaselineSchema = Schema.Record(
  Schema.String,
  Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
);

const decodeBaseline = Schema.decodeUnknownOption(BaselineSchema);

/** Validate the persisted source-name to row-count mapping. */
export function validateBaseline(value: Schema.Json): Baseline | undefined {
  return Option.getOrUndefined(decodeBaseline(value));
}

/** Compare an observed count with the last successful observation. */
export function evaluateCount(
  observed: number,
  previous: number | undefined,
  threshold: number,
): CountEvaluation {
  if (previous === undefined) {
    return { status: "first-run", observed };
  }

  const floor = previous * threshold;

  if (observed < floor) {
    return { status: "drift", observed, previous, floor };
  }

  return { status: "accepted", observed, previous };
}

/** Promote a complete observation atomically; failures preserve the prior baseline. */
export function promoteBaseline(
  previous: Baseline,
  observed: Baseline,
  succeeded: boolean,
): Baseline {
  return succeeded ? { ...previous, ...observed } : { ...previous };
}
