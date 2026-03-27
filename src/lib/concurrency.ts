/**
 * Concurrency utilities for batching parallel operations.
 *
 * Provides a `batchedMap` function that processes items in fixed-size
 * batches to avoid overwhelming upstream APIs with unbounded concurrency.
 */

/**
 * Map over items in batches with optional inter-batch delay.
 *
 * Items within each batch run concurrently via `Promise.all`, but batches
 * are processed sequentially. Results are returned in the same order as
 * the input array.
 *
 * @param items - The items to process.
 * @param fn - Async function to apply to each item.
 * @param options - Optional batch size and inter-batch delay.
 * @returns Results in input order.
 *
 * @example
 * ```ts
 * const results = await batchedMap(urls, fetchData, { batchSize: 5, delayMs: 300 });
 * ```
 */
export async function batchedMap<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
  options?: { readonly batchSize?: number; readonly delayMs?: number },
): Promise<R[]> {
  const batchSize = options?.batchSize ?? 5;
  const delayMs = options?.delayMs ?? 0;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);

    if (delayMs > 0 && i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
