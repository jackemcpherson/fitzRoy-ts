/**
 * Per-request timeout wrapping for source-client fetch functions.
 *
 * Every outbound request gets an AbortSignal so a hung upstream can
 * never block a consumer indefinitely (a stalled FootyWire page or AFL
 * token endpoint previously froze the whole Result chain — and every
 * downstream consumer — forever).
 */

/** Default per-request timeout applied to every outbound fetch. */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/** Timeout/cancellation options shared by all source clients. */
export interface FetchTimeoutOptions {
  /**
   * Caller-supplied signal combined with the per-request timeout, so
   * callers can cancel all in-flight requests (e.g. on their own
   * deadline) without disabling the default timeout.
   */
  readonly signal?: AbortSignal | undefined;
  /** Per-request timeout in milliseconds. Defaults to 30 000. */
  readonly timeoutMs?: number | undefined;
}

/**
 * Wrap a fetch implementation so each call carries an abort signal.
 *
 * Precedence per request: an explicit `init.signal` wins untouched;
 * otherwise the client-level signal (if any) is combined with a fresh
 * `AbortSignal.timeout` for this request.
 *
 * @param fetchFn - The underlying fetch implementation.
 * @param options - Client-level signal/timeout options.
 * @returns A fetch-compatible function with timeout behaviour applied.
 */
export function withFetchTimeout(
  fetchFn: typeof fetch,
  options?: FetchTimeoutOptions,
): typeof fetch {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const clientSignal = options?.signal;
  return (input, init?) => {
    if (init?.signal) {
      return fetchFn(input, init);
    }
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = clientSignal ? AbortSignal.any([clientSignal, timeout]) : timeout;
    return fetchFn(input, { ...init, signal });
  };
}
