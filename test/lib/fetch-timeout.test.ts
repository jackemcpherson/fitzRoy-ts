import { describe, expect, it, vi } from "vitest";
import { withFetchTimeout } from "../../src/lib/fetch-timeout";

function abortAwareFetch(): typeof fetch {
  return ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise((resolve, reject) => {
      if (!init?.signal) {
        resolve(new Response("no signal"));
        return;
      }
      init.signal.addEventListener("abort", () => reject(init.signal?.reason));
    })) as typeof fetch;
}

describe("withFetchTimeout", () => {
  it("attaches an abort signal to every request by default", async () => {
    const seen: Array<RequestInit | undefined> = [];
    const inner = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init);
      return new Response("ok");
    }) as unknown as typeof fetch;

    const wrapped = withFetchTimeout(inner);
    await wrapped("https://example.com/");
    expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts a hung request once the timeout elapses", async () => {
    const wrapped = withFetchTimeout(abortAwareFetch(), { timeoutMs: 20 });
    await expect(wrapped("https://example.com/")).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("leaves an explicit per-request init.signal untouched", async () => {
    const seen: Array<RequestInit | undefined> = [];
    const inner = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init);
      return new Response("ok");
    }) as unknown as typeof fetch;

    const controller = new AbortController();
    const wrapped = withFetchTimeout(inner, { timeoutMs: 20 });
    await wrapped("https://example.com/", { signal: controller.signal });
    expect(seen[0]?.signal).toBe(controller.signal);
  });

  it("combines a client-level signal with the timeout", async () => {
    const controller = new AbortController();
    const wrapped = withFetchTimeout(abortAwareFetch(), {
      signal: controller.signal,
      timeoutMs: 10_000,
    });
    const pending = wrapped("https://example.com/");
    controller.abort(new Error("caller cancelled"));
    await expect(pending).rejects.toMatchObject({ message: "caller cancelled" });
  });
});
