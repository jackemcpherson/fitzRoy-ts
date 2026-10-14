/**
 * The HTTP seam shared by every data source.
 *
 * {@link SourceHttp} wraps Effect's standard `FetchHttpClient.Fetch` reference
 * with the source request policy: a fresh timeout per attempt and an optional
 * single jittered retry on 5xx responses. The timeout also bounds reading the
 * response body, as the v6 `AbortSignal.timeout` did. Sources receive web `Response`
 * objects, so their status handling and error messages stay unchanged.
 *
 * Tests replace `FetchHttpClient.Fetch` with a fixture-backed function
 * instead of stubbing the global `fetch`.
 */

import { Context, Duration, Effect, Layer, Random, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

/** Request policy for every source request. */
export interface SourceHttpOptions {
  /** Timeout for each attempt. */
  readonly timeout: Duration.Input;
  /** Retry once after 250-750 ms when a response has a 5xx status. */
  readonly retry5xx: boolean;
}

/** The request policy, defaulting to a 30-second timeout and no retry. */
export const SourceHttpConfig = Context.Reference<SourceHttpOptions>("fitzroy/SourceHttpConfig", {
  defaultValue: () => ({ timeout: "30 seconds", retry5xx: false }),
});

/** A request that produced no response: a network failure, an abort, or a timeout. */
export class RequestError extends Schema.TaggedError<RequestError>()("RequestError", {
  message: Schema.String,
}) {}

/** Request options a source can set. */
export interface SourceRequestInit {
  readonly method?: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
}

/** Performs source requests under the configured policy. */
export class SourceHttp extends Context.Service<
  SourceHttp,
  {
    /** Request a URL and return the web `Response`, whatever its status. */
    readonly request: (
      url: string,
      init?: SourceRequestInit,
    ) => Effect.Effect<Response, RequestError>;
  }
>()("fitzroy/SourceHttp") {}

/** Message of a rejected promise or thrown value, matching the v6 `cause.message` text. */
export function failureMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Release a response that will not be read, so its connection is not held
 * until garbage collection. A failure to cancel changes nothing for the caller.
 */
export function discardBody(response: Response): Effect.Effect<void> {
  return Effect.tryPromise(async () => {
    await response.body?.cancel();
  }).pipe(Effect.ignore);
}

/** Build the `fetch` options for one attempt. */
function requestInit(init: SourceRequestInit | undefined, signal: AbortSignal): RequestInit {
  const options: RequestInit = { method: init?.method ?? "GET", signal };

  if (init?.headers !== undefined) options.headers = { ...init.headers };

  return options;
}

const TIMEOUT_MESSAGE = "The operation was aborted due to timeout";

/** The live request policy over `FetchHttpClient.Fetch`. */
export const SourceHttpLive = Layer.effect(
  SourceHttp,
  Effect.gen(function* () {
    const fetch = yield* FetchHttpClient.Fetch;
    const config = yield* SourceHttpConfig;

    const timeoutMillis = Duration.toMillis(config.timeout);

    // The effect timeout covers waiting for headers; the deadline signal also
    // aborts the body stream, so a response that stalls mid-body still fails.
    const attempt = (url: string, init: SourceRequestInit | undefined) =>
      Effect.tryPromise({
        try: (signal) => {
          const deadline = AbortSignal.timeout(timeoutMillis);

          return fetch(url, requestInit(init, AbortSignal.any([signal, deadline])));
        },
        catch: (cause) => new RequestError({ message: failureMessage(cause) }),
      }).pipe(
        Effect.timeoutOrElse({
          duration: config.timeout,
          orElse: () => Effect.fail(new RequestError({ message: TIMEOUT_MESSAGE })),
        }),
      );

    return {
      request: (url, init) =>
        Effect.gen(function* () {
          const response = yield* attempt(url, init);

          if (!config.retry5xx || response.status < 500 || response.status > 599) return response;
          yield* discardBody(response);
          const jitter = yield* Random.nextIntBetween(0, 500);

          yield* Effect.sleep(250 + jitter);

          return yield* attempt(url, init);
        }),
    };
  }),
);

/** Read a response body as text. */
export function readText(response: Response): Effect.Effect<string, RequestError> {
  return Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) => new RequestError({ message: failureMessage(cause) }),
  });
}

/** Read a response body as bytes. */
export function readBytes(response: Response): Effect.Effect<Uint8Array, RequestError> {
  return Effect.tryPromise({
    try: async () => new Uint8Array(await response.arrayBuffer()),
    catch: (cause) => new RequestError({ message: failureMessage(cause) }),
  });
}

/** Read a response body as JSON; the result is decoded by the caller's schema. */
export function readJson(response: Response): Effect.Effect<Schema.Json, RequestError> {
  return Effect.tryPromise({
    // SAFETY: `Response.json()` returns parsed JSON, which is exactly `Schema.Json`.
    try: () => response.json() as Promise<Schema.Json>,
    catch: (cause) => new RequestError({ message: failureMessage(cause) }),
  });
}
