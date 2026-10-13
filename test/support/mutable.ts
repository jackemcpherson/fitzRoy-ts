/**
 * A deeply mutable view of a decoded type.
 *
 * Effect Schema decodes to readonly types. Test factories return this view so
 * individual tests can adjust a fresh fixture before passing it to the code
 * under test, which accepts the readonly type.
 */
export type DeepMutable<T> =
  T extends ReadonlyArray<infer U>
    ? DeepMutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T;
