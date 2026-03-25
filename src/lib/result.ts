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
