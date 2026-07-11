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

/** Validate the persisted source-name to row-count mapping. */
export function validateBaseline(value: unknown): Baseline | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const baseline: Baseline = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
      return undefined;
    }
    baseline[key] = count;
  }
  return baseline;
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
