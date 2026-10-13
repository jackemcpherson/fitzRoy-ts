import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import {
  RequestError,
  SourceHttp,
  SourceHttpConfig,
  SourceHttpLive,
  type SourceHttpOptions,
} from "../../src/lib/http";

/** SourceHttp over `fetch` with the given policy. */
function httpWith(fetch: typeof globalThis.fetch, options: SourceHttpOptions) {
  return SourceHttpLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(FetchHttpClient.Fetch, fetch),
        Layer.succeed(SourceHttpConfig, options),
      ),
    ),
  );
}

/** A fetch that answers with each status in turn and counts calls. */
function sequence(statuses: readonly number[]) {
  const calls: string[] = [];

  const fetch: typeof globalThis.fetch = async (input) => {
    const status = statuses[calls.length] ?? 200;

    calls.push(input instanceof Request ? input.url : input instanceof URL ? input.href : input);

    return new Response(null, { status });
  };

  return { calls, fetch };
}

const NO_RETRY: SourceHttpOptions = { timeout: "30 seconds", retry5xx: false };

const RETRY: SourceHttpOptions = { timeout: "30 seconds", retry5xx: true };

describe("SourceHttp 5xx retry", () => {
  it.effect("does not retry unless enabled", () => {
    const { calls, fetch } = sequence([503]);

    return Effect.gen(function* () {
      const response = yield* SourceHttp.use((http) => http.request("https://x/a"));

      expect(response.status).toBe(503);
      expect(calls).toHaveLength(1);
    }).pipe(Effect.provide(httpWith(fetch, NO_RETRY)));
  });

  it.effect("retries exactly once on 5xx after a 250-750 ms pause when enabled", () => {
    const { calls, fetch } = sequence([503, 200]);

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(SourceHttp.use((http) => http.request("https://x/a")));

      yield* TestClock.adjust("249 millis");
      expect(calls).toHaveLength(1);
      yield* TestClock.adjust("501 millis");
      const response = yield* Fiber.join(fiber);

      expect(response.status).toBe(200);
      expect(calls).toHaveLength(2);
    }).pipe(Effect.provide(httpWith(fetch, RETRY)));
  });

  it.effect("returns the second response even if it also fails", () => {
    const { calls, fetch } = sequence([500, 502]);

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(SourceHttp.use((http) => http.request("https://x/a")));

      yield* TestClock.adjust("1 second");
      const response = yield* Fiber.join(fiber);

      expect(response.status).toBe(502);
      expect(calls).toHaveLength(2);
    }).pipe(Effect.provide(httpWith(fetch, RETRY)));
  });

  it.effect("does not retry 4xx responses", () => {
    const { calls, fetch } = sequence([404]);

    return Effect.gen(function* () {
      const response = yield* SourceHttp.use((http) => http.request("https://x/a"));

      expect(response.status).toBe(404);
      expect(calls).toHaveLength(1);
    }).pipe(Effect.provide(httpWith(fetch, RETRY)));
  });
});

describe("SourceHttp timeout and failures", () => {
  it.effect("passes an abort signal and the headers to every request", () => {
    const inits: Array<RequestInit | undefined> = [];

    const fetch: typeof globalThis.fetch = async (_input, init) => {
      inits.push(init);

      return new Response("ok");
    };

    return Effect.gen(function* () {
      yield* SourceHttp.use((http) =>
        http.request("https://x/a", { headers: { "User-Agent": "test" } }),
      );
      expect(inits[0]?.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(inits[0]?.headers).get("User-Agent")).toBe("test");
    }).pipe(Effect.provide(httpWith(fetch, NO_RETRY)));
  });

  it.effect("fails with a timeout RequestError and aborts a hung request", () => {
    let aborted = false;

    const fetch: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        });
      });

    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        Effect.flip(SourceHttp.use((http) => http.request("https://x/a"))),
      );

      yield* TestClock.adjust("30 seconds");
      const error = yield* Fiber.join(fiber);

      expect(error).toBeInstanceOf(RequestError);
      expect(error.message).toBe("The operation was aborted due to timeout");
      expect(aborted).toBe(true);
    }).pipe(Effect.provide(httpWith(fetch, NO_RETRY)));
  });

  it.effect("fails with the rejection message when fetch rejects", () => {
    const fetch: typeof globalThis.fetch = () => Promise.reject(new Error("ECONNRESET"));

    return Effect.gen(function* () {
      const error = yield* Effect.flip(SourceHttp.use((http) => http.request("https://x/a")));

      expect(error.message).toBe("ECONNRESET");
    }).pipe(Effect.provide(httpWith(fetch, NO_RETRY)));
  });
});
