import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@jackemcpherson/rds-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@jackemcpherson/rds-js")>();
  return { ...actual, parseRds: vi.fn(actual.parseRds) };
});

import { parseRds } from "@jackemcpherson/rds-js";
import { ScrapeError } from "../../src/lib/errors";
import { FryziggClient } from "../../src/sources/fryzigg";
import { FRYZIGG_SNAPSHOTS } from "../../src/sources/fryzigg-snapshots";

const FIXTURE_SHA256 = "e41773328a6cd1e926f22a1ed0f54cc18e4d0d21743172bdbde3b2f87843cd58";

const fixtureBuffer = new Uint8Array(
  readFileSync(join(__dirname, "..", "fixtures", "fryzigg-sample.rds")),
);

function mockFetchOk(): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(fixtureBuffer, { status: 200 }));
}

describe("FryziggClient", () => {
  it("fetches and parses AFLM RDS file into a DataFrame", async () => {
    const client = new FryziggClient({ fetchFn: mockFetchOk(), sha256: FIXTURE_SHA256 });
    const result = await client.fetchPlayerStats("AFLM");

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.names).toContain("match_id");
    expect(result.data.names).toContain("player_id");
    expect(result.data.names).toContain("kicks");
    expect(result.data.columns.length).toBe(80);
  });

  it("uses the AFLW URL when competition is AFLW", async () => {
    const mockFetch = mockFetchOk();
    const client = new FryziggClient({ fetchFn: mockFetch, sha256: FIXTURE_SHA256 });
    await client.fetchPlayerStats("AFLW");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("aflw_player_stats.rds"),
      expect.any(Object),
    );
  });

  it("returns error for non-OK HTTP response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }));
    const client = new FryziggClient({ fetchFn: mockFetch });
    const result = await client.fetchPlayerStats("AFLM");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.message).toContain("404");
  });

  it("returns error for network failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network unreachable"));
    const client = new FryziggClient({ fetchFn: mockFetch });
    const result = await client.fetchPlayerStats("AFLM");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.message).toContain("Network unreachable");
  });

  it("returns error for invalid RDS data", async () => {
    const badFetch = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([0x00, 0x01, 0x02]), { status: 200 }));
    const client = new FryziggClient({
      fetchFn: badFetch,
      sha256: "ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc",
    });
    const result = await client.fetchPlayerStats("AFLM");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.source).toBe("fryzigg");
  });

  it("includes User-Agent header in request", async () => {
    const mockFetch = mockFetchOk();
    const client = new FryziggClient({ fetchFn: mockFetch, sha256: FIXTURE_SHA256 });
    await client.fetchPlayerStats("AFLM");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("fitzRoy-ts") }),
      }),
    );
  });

  it("rejects modified bytes before parsing", async () => {
    vi.mocked(parseRds).mockClear();
    const modified = fixtureBuffer.slice();
    modified[modified.length - 1] ^= 0x01;
    const client = new FryziggClient({
      fetchFn: vi.fn().mockResolvedValue(new Response(modified, { status: 200 })),
      sha256: FIXTURE_SHA256,
    });

    const result = await client.fetchPlayerStats("AFLM");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.message).toBe("Fryzigg checksum mismatch for AFLM snapshot");
    expect(result.error.message).not.toContain(FIXTURE_SHA256);
    expect(parseRds).not.toHaveBeenCalled();
  });

  it("uses the reviewed manifest checksum by default", async () => {
    const client = new FryziggClient({ fetchFn: mockFetchOk() });
    const result = await client.fetchPlayerStats("AFLM");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toBe("Fryzigg checksum mismatch for AFLM snapshot");
    expect(FRYZIGG_SNAPSHOTS.AFLM.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns an explicit error for unsupported competitions", async () => {
    const fetchFn = vi.fn();
    const client = new FryziggClient({ fetchFn });
    const result = await client.fetchPlayerStats("VFL");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toContain("does not publish VFL data");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
