import { describe, expect, it, vi } from "vitest";
import { SquiggleMatchSource } from "../../../src/sources/adapters/squiggle";
import type { SquiggleClient } from "../../../src/sources/squiggle";

function clientSpy() {
  const fetchGames = vi.fn(async () => ({
    success: true as const,
    data: { games: [] },
  }));
  return { fetchGames, client: { fetchGames } as unknown as SquiggleClient };
}

describe("SquiggleMatchSource status handling (COR-02)", () => {
  it("omits the complete filter for Upcoming queries so fixtures can return", async () => {
    const { fetchGames, client } = clientSpy();
    const source = new SquiggleMatchSource(client);

    const result = await source.fetchMatches({
      source: "squiggle",
      season: 2026,
      status: "Upcoming",
    });

    expect(result.success).toBe(true);
    expect(fetchGames).toHaveBeenCalledWith(2026, undefined, undefined);
  });

  it("omits the complete filter when no status is requested", async () => {
    const { fetchGames, client } = clientSpy();
    const source = new SquiggleMatchSource(client);

    await source.fetchMatches({ source: "squiggle", season: 2026 });
    expect(fetchGames).toHaveBeenCalledWith(2026, undefined, undefined);
  });

  it("passes complete=100 only for Complete queries", async () => {
    const { fetchGames, client } = clientSpy();
    const source = new SquiggleMatchSource(client);

    await source.fetchMatches({ source: "squiggle", season: 2026, status: "Complete" });
    expect(fetchGames).toHaveBeenCalledWith(2026, undefined, 100);
  });
});
