/**
 * Result type for representing success/failure without exceptions.
 *
 * Use `ok(value)` for successes and `err(error)` for expected failures.
 * Prefer this over throwing for operations that can predictably fail
 * (network requests, parsing, validation).
 */

/** A successful result containing data of type `T`. */
export interface Ok<T> {
  readonly success: true;
  readonly data: T;
}

/** A failed result containing an error of type `E`. */
export interface Err<E> {
  readonly success: false;
  readonly error: E;
}

/** Discriminated union representing either success or failure. */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/** Create a successful result. */
export function ok<T>(data: T): Ok<T> {
  return { success: true, data };
}

/** Create a failed result. */
export function err<E>(error: E): Err<E> {
  return { success: false, error };
}

/**
 * Result composition combinators.
 *
 * Use these to chain `Result`-returning operations without the
 * `if (!result.success) return result` boilerplate that otherwise
 * accumulates at every call site. Free-function namespace style: the
 * underlying discriminated union is unchanged, so existing
 * `result.success` narrowing still works alongside.
 *
 * @example
 * ```ts
 * const adapterR = dispatch(matchRegistry, "match", query);
 * const matchesR = await Result.flatMapAsync(adapterR, (a) => a.fetchMatches(query));
 * return Result.map(matchesR, (ms) => filterMatches(ms, query));
 * ```
 */
export const Result = {
  /** Transform the success value of a Result. Errors pass through unchanged. */
  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.success ? ok(fn(result.data)) : result;
  },

  /** Chain a Result-returning function. Errors short-circuit. */
  flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
    return result.success ? fn(result.data) : result;
  },

  /**
   * Chain an async Result-returning function. Errors short-circuit without
   * invoking `fn`.
   */
  async flatMapAsync<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Promise<Result<U, E>>,
  ): Promise<Result<U, E>> {
    return result.success ? fn(result.data) : result;
  },

  /**
   * Collect an array of Results into a single Result of an array. Returns
   * the first error encountered, or `ok` of all successful values.
   */
  all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
    const data: T[] = [];
    for (const r of results) {
      if (!r.success) return r;
      data.push(r.data);
    }
    return ok(data);
  },

  /** Transform the error value of a Result. Successes pass through unchanged. */
  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.success ? result : err(fn(result.error));
  },
};
