import { describe, expect, it, vi } from "vitest";
import { withRetry5xx } from "../../src/lib/fetch-retry";

describe("withRetry5xx", () => {
  it("is a no-op unless enabled", async () => {
    const inner = vi.fn(
      async () => new Response("down", { status: 503 }),
    ) as unknown as typeof fetch;
    const wrapped = withRetry5xx(inner);
    const res = await wrapped("https://example.com/");
    expect(res.status).toBe(503);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once on 5xx when enabled", async () => {
    const inner = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 })) as unknown as typeof fetch;
    const wrapped = withRetry5xx(inner, { retry5xx: true });
    const res = await wrapped("https://example.com/");
    expect(res.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("returns the second response even if it also fails", async () => {
    const inner = vi.fn(
      async () => new Response("down", { status: 502 }),
    ) as unknown as typeof fetch;
    const wrapped = withRetry5xx(inner, { retry5xx: true });
    const res = await wrapped("https://example.com/");
    expect(res.status).toBe(502);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx responses", async () => {
    const inner = vi.fn(
      async () => new Response("nope", { status: 404 }),
    ) as unknown as typeof fetch;
    const wrapped = withRetry5xx(inner, { retry5xx: true });
    const res = await wrapped("https://example.com/");
    expect(res.status).toBe(404);
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
