import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ScrapeError } from "../../src/lib/errors";
import { FryziggClient } from "../../src/sources/fryzigg";

const fixtureBuffer = new Uint8Array(
  readFileSync(join(__dirname, "..", "fixtures", "fryzigg-sample.rds")),
);

function mockFetchOk(): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(fixtureBuffer, { status: 200 }));
}

describe("FryziggClient", () => {
  it("fetches and parses AFLM RDS file into a DataFrame", async () => {
    const client = new FryziggClient({ fetchFn: mockFetchOk() });
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
    const client = new FryziggClient({ fetchFn: mockFetch });
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
    const client = new FryziggClient({ fetchFn: badFetch });
    const result = await client.fetchPlayerStats("AFLM");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.source).toBe("fryzigg");
  });

  it("includes User-Agent header in request", async () => {
    const mockFetch = mockFetchOk();
    const client = new FryziggClient({ fetchFn: mockFetch });
    await client.fetchPlayerStats("AFLM");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("fitzRoy-ts") }),
      }),
    );
  });
});
