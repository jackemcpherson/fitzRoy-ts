/**
 * Optional single-retry policy for transient upstream failures.
 *
 * A lone 503 from a scrape source previously aborted a whole-season
 * fetch. Behind an opt-in flag, one jittered retry absorbs blips
 * without hammering an upstream that is genuinely down.
 */

/** Options enabling a single jittered retry on HTTP 5xx responses. */
export interface FetchRetryOptions {
  /** Retry once (with 250–750 ms jitter) on 5xx responses. Off by default. */
  readonly retry5xx?: boolean | undefined;
}

const RETRY_BASE_DELAY_MS = 250;
const RETRY_JITTER_MS = 500;

/**
 * Wrap a fetch implementation with a single jittered retry on 5xx.
 *
 * Returns the original function untouched unless `retry5xx` is true.
 * Network errors are not retried — only responses with a 5xx status.
 */
export function withRetry5xx(fetchFn: typeof fetch, options?: FetchRetryOptions): typeof fetch {
  if (options?.retry5xx !== true) {
    return fetchFn;
  }
  return async (input, init?) => {
    const first = await fetchFn(input, init);
    if (first.status < 500 || first.status > 599) {
      return first;
    }
    const delay = RETRY_BASE_DELAY_MS + Math.random() * RETRY_JITTER_MS;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchFn(input, init);
  };
}
