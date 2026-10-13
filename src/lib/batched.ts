/**
 * Polite batching for source requests (ADR-0003).
 *
 * Items run concurrently within each batch, batches run one after another,
 * and an optional gap separates batches so scrapers stay within each
 * upstream's tolerance.
 */

import { Array as Arr, type Duration, Effect } from "effect";

/** Batch size and inter-batch gap. */
export interface BatchOptions {
  /** Items per batch (default 5). */
  readonly batchSize?: number;
  /** Pause between batches (default none). */
  readonly gap?: Duration.Input;
}

/**
 * Map over items in batches, returning results in input order.
 *
 * The first failure fails the whole run. Wrap `f` with `Effect.result` when
 * a failed item must not stop the others.
 *
 * @example
 * ```ts
 * const pages = yield* batched(urls, fetchPage, { batchSize: 5, gap: "300 millis" });
 * ```
 */
export function batched<A, B, E, R>(
  items: ReadonlyArray<A>,
  f: (item: A) => Effect.Effect<B, E, R>,
  options?: BatchOptions,
): Effect.Effect<B[], E, R> {
  const batchSize = options?.batchSize ?? 5;
  const batches = Arr.chunksOf(items, batchSize);

  return Effect.forEach(batches, (batch, index) =>
    Effect.gen(function* () {
      if (index > 0 && options?.gap !== undefined) yield* Effect.sleep(options.gap);

      return yield* Effect.forEach(batch, f, { concurrency: "unbounded" });
    }),
  ).pipe(Effect.map((results) => results.flat()));
}
