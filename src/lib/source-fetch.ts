/**
 * The standard fetch pipeline shared by every source client.
 */

import { type FetchRetryOptions, withRetry5xx } from "./fetch-retry";
import { type FetchTimeoutOptions, withFetchTimeout } from "./fetch-timeout";

/** Common fetch-behaviour options accepted by every source client. */
export interface SourceFetchOptions extends FetchTimeoutOptions, FetchRetryOptions {
  /** Custom fetch implementation (defaults to global `fetch`). */
  readonly fetchFn?: typeof fetch | undefined;
}

/**
 * Compose the source-client fetch pipeline: per-request timeout
 * innermost (so each retry attempt gets a fresh timeout), optional
 * single jittered 5xx retry outermost.
 */
export function createSourceFetch(options?: SourceFetchOptions): typeof fetch {
  // Defer the globalThis.fetch lookup to call-time so tests that stub the
  // global after module load (e.g. via vi.stubGlobal) still take effect for
  // clients constructed at import time (the shared AflApiClient).
  const base: typeof fetch = options?.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
  return withRetry5xx(withFetchTimeout(base, options), options);
}
