/**
 * Fixture-backed HTTP for tests.
 *
 * Replaces `FetchHttpClient.Fetch` under the real {@link SourceHttpLive}
 * policy, so source services run their production request code against
 * committed fixtures. No global `fetch` stubbing and no module mocks.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { SourceHttpConfig, SourceHttpLive } from "../../src/lib/http";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

/** Read a committed fixture as text. */
export function fixtureText(name: string): string {
  return readFileSync(resolve(FIXTURES, name), "utf-8");
}

/** Read a committed fixture as bytes. */
export function fixtureBytes(name: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(readFileSync(resolve(FIXTURES, name)));
}

/** How a route answers: a fixture body and status, or a custom responder. */
export type RouteAnswer =
  | { readonly body?: string | Uint8Array<ArrayBuffer>; readonly status?: number }
  | {
      readonly respond: (
        url: string,
        init: RequestInit | undefined,
      ) => Response | Promise<Response>;
    };

/** A URL pattern and its answer. The first matching route wins. */
export type Route = readonly [RegExp | string, RouteAnswer];

/** Every request a fixture fetch received, in order. */
export interface RequestLog {
  readonly urls: string[];
  readonly inits: Array<RequestInit | undefined>;
}

/** Build a `fetch` that answers from routes; unmatched URLs get a 404. */
export function fixtureFetch(routes: readonly Route[], log?: RequestLog): typeof fetch {
  return async (input, init) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;

    log?.urls.push(url);
    log?.inits.push(init);

    const route = routes.find(([pattern]) =>
      pattern instanceof RegExp ? pattern.test(url) : url.includes(pattern),
    );

    if (!route) return new Response("not found", { status: 404 });
    const answer = route[1];

    if ("respond" in answer) return answer.respond(url, init);

    return new Response(answer.body ?? "", { status: answer.status ?? 200 });
  };
}

/** An empty request log to pass to {@link fixtureFetch}. */
export function requestLog(): RequestLog {
  return { urls: [], inits: [] };
}

/**
 * The real `SourceHttp` policy over a fixture `fetch`.
 *
 * Provide it under a source's live layer:
 * `SquiggleLive.pipe(Layer.provide(fixtureHttp(routes)))`.
 */
export function fixtureHttp(
  routes: readonly Route[],
  options?: { readonly log?: RequestLog; readonly retry5xx?: boolean },
) {
  return SourceHttpLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(FetchHttpClient.Fetch, fixtureFetch(routes, options?.log)),
        Layer.succeed(SourceHttpConfig, {
          timeout: "30 seconds",
          retry5xx: options?.retry5xx ?? false,
        }),
      ),
    ),
  );
}
