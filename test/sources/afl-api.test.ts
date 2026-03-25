import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { AflApiError, ValidationError } from "../../src/lib/errors";
import { AflApiClient } from "../../src/sources/afl-api";

/** Helper to create a mock Response. */
function mockResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText ?? "OK",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

/** Standard valid token response. */
const VALID_TOKEN = {
  access_token: "test-token-123",
  token_type: "Bearer",
  expires_in: 3600,
};

describe("AflApiClient", () => {
  describe("authenticate", () => {
    it("returns access token on success", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockResponse(VALID_TOKEN));
      const client = new AflApiClient({ fetchFn });

      const result = await client.authenticate();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("test-token-123");
      }
      expect(fetchFn).toHaveBeenCalledWith("https://api.afl.com.au/cfs/afl/WMCTok", {
        method: "POST",
      });
    });

    it("caches the token so isAuthenticated returns true", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockResponse(VALID_TOKEN));
      const client = new AflApiClient({ fetchFn });

      expect(client.isAuthenticated).toBe(false);
      await client.authenticate();
      expect(client.isAuthenticated).toBe(true);
    });

    it("returns error on non-OK response", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValue(mockResponse({}, { status: 500, statusText: "Internal Server Error" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.authenticate();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AflApiError);
        expect(result.error.statusCode).toBe(500);
      }
    });

    it("returns error on invalid token format", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockResponse({ invalid: true }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.authenticate();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AflApiError);
        expect(result.error.message).toContain("Invalid token response format");
      }
    });

    it("returns error on network failure", async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error("Network unreachable"));
      const client = new AflApiClient({ fetchFn });

      const result = await client.authenticate();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Network unreachable");
      }
    });

    it("uses custom tokenUrl when provided", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockResponse(VALID_TOKEN));
      const client = new AflApiClient({ fetchFn, tokenUrl: "https://custom.token/endpoint" });

      await client.authenticate();

      expect(fetchFn).toHaveBeenCalledWith("https://custom.token/endpoint", { method: "POST" });
    });
  });

  describe("authedFetch", () => {
    it("authenticates automatically if not already authenticated", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({ data: "test" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.authedFetch("https://api.afl.com.au/test");

      expect(result.success).toBe(true);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("adds bearer token to request headers", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({ data: "test" }));
      const client = new AflApiClient({ fetchFn });

      await client.authedFetch("https://api.afl.com.au/test");

      const secondCall = fetchFn.mock.calls[1];
      const headers = secondCall?.[1]?.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer test-token-123");
    });

    it("retries once on 401 by re-authenticating", async () => {
      const freshToken = { ...VALID_TOKEN, access_token: "refreshed-token" };
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({}, { status: 401, statusText: "Unauthorized" }))
        .mockResolvedValueOnce(mockResponse(freshToken))
        .mockResolvedValueOnce(mockResponse({ data: "success" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.authedFetch("https://api.afl.com.au/test");

      expect(result.success).toBe(true);
      expect(fetchFn).toHaveBeenCalledTimes(4);
    });

    it("returns error if re-authentication on 401 fails", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({}, { status: 401, statusText: "Unauthorized" }))
        .mockResolvedValueOnce(
          mockResponse({}, { status: 500, statusText: "Internal Server Error" }),
        );
      const client = new AflApiClient({ fetchFn });

      const result = await client.authedFetch("https://api.afl.com.au/test");

      expect(result.success).toBe(false);
    });

    it("returns error on non-OK response that is not 401", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({}, { status: 404, statusText: "Not Found" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.authedFetch("https://api.afl.com.au/test");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AflApiError);
        expect(result.error.statusCode).toBe(404);
      }
    });

    it("returns error on network failure during fetch", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockRejectedValueOnce(new Error("Connection reset"));
      const client = new AflApiClient({ fetchFn });

      const result = await client.authedFetch("https://api.afl.com.au/test");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Connection reset");
      }
    });
  });

  describe("fetchJson", () => {
    const TestSchema = z.object({ value: z.number() });

    it("fetches, parses, and validates JSON against a Zod schema", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({ value: 42 }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchJson("https://api.afl.com.au/test", TestSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ value: 42 });
      }
    });

    it("returns ValidationError when response does not match schema", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({ wrong: "shape" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchJson("https://api.afl.com.au/test", TestSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it("returns AflApiError when fetch fails", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(
          mockResponse({}, { status: 500, statusText: "Internal Server Error" }),
        );
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchJson("https://api.afl.com.au/test", TestSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AflApiError);
      }
    });

    it("returns AflApiError when response is not valid JSON", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(
          new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } }),
        );
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchJson("https://api.afl.com.au/test", TestSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AflApiError);
        expect(result.error.message).toContain("JSON parse failed");
      }
    });
  });

  describe("isAuthenticated", () => {
    it("returns false when no token is cached", () => {
      const client = new AflApiClient({ fetchFn: vi.fn() });
      expect(client.isAuthenticated).toBe(false);
    });

    it("returns false when token has expired", async () => {
      const expiredToken = { ...VALID_TOKEN, expires_in: 0 };
      const fetchFn = vi.fn().mockResolvedValue(mockResponse(expiredToken));
      const client = new AflApiClient({ fetchFn });

      await client.authenticate();

      expect(client.isAuthenticated).toBe(false);
    });
  });
});
