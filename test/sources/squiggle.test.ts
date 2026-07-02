import { describe, expect, it } from "vitest";
import { ScrapeError } from "../../src/lib/errors";
import { SquiggleClient } from "../../src/sources/squiggle";

// Minimal valid game payload derived from test/fixtures/squiggle-games-2024-r1.json
const VALID_GAME = {
  id: 35704,
  year: 2024,
  round: 1,
  roundname: "Round 1",
  hteam: "Carlton",
  ateam: "Richmond",
  hteamid: 3,
  ateamid: 14,
  hscore: 86,
  ascore: 81,
  hgoals: 12,
  agoals: 12,
  hbehinds: 14,
  abehinds: 9,
  winner: "Carlton",
  winnerteamid: 3,
  venue: "M.C.G.",
  date: "2024-03-14 19:30:00",
  localtime: "2024-03-14 19:30:00",
  tz: "+11:00",
  unixtime: 1710405000,
  timestr: "Full Time",
  complete: 100,
  is_final: 0,
  is_grand_final: 0,
  updated: "2024-03-14 22:14:45",
};

// Minimal valid standing payload derived from test/fixtures/squiggle-standings-2024-r10.json
const VALID_STANDING = {
  id: 16,
  name: "Sydney",
  rank: 1,
  played: 10,
  wins: 9,
  losses: 1,
  draws: 0,
  pts: 36,
  for: 1030,
  against: 666,
  percentage: 154.654654654655,
  goals_for: 151,
  goals_against: 92,
  behinds_for: 124,
  behinds_against: 114,
};

function clientWith(response: Response | Error): { client: SquiggleClient; calls: string[] } {
  const calls: string[] = [];
  const fetchFn: typeof fetch = async (input, _init) => {
    calls.push(String(input));
    if (response instanceof Error) throw response;
    return response;
  };
  return { client: new SquiggleClient({ fetchFn }), calls };
}

describe("SquiggleClient.fetchGames", () => {
  it("builds the correct URL and includes fitzRoy-ts User-Agent header", async () => {
    const capturedInits: (RequestInit | undefined)[] = [];
    const capturedUrls: string[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      capturedUrls.push(String(input));
      capturedInits.push(init);
      return new Response(JSON.stringify({ games: [VALID_GAME] }), { status: 200 });
    };
    const client = new SquiggleClient({ fetchFn });

    const result = await client.fetchGames(2025, 3);

    expect(result.success).toBe(true);
    expect(capturedUrls).toHaveLength(1);
    const url = capturedUrls[0] ?? "";
    expect(url).toContain("q=games");
    expect(url).toContain("year=2025");
    expect(url).toContain("round=3");

    const init = capturedInits[0];
    const headers = init?.headers as Record<string, string> | undefined;
    const userAgent = headers?.["User-Agent"] ?? "";
    expect(userAgent).toContain("fitzRoy-ts");
  });

  it("returns parsed games on a valid response", async () => {
    const { client } = clientWith(
      new Response(JSON.stringify({ games: [VALID_GAME] }), { status: 200 }),
    );

    const result = await client.fetchGames(2024, 1);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.games).toHaveLength(1);
    expect(result.data.games[0]?.hteam).toBe("Carlton");
  });

  it("returns a ScrapeError containing the status code on a non-ok response", async () => {
    const { client } = clientWith(new Response("Internal Server Error", { status: 500 }));

    const result = await client.fetchGames(2024, 1);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.message).toContain("500");
  });

  it("returns a ScrapeError containing the cause message when fetch throws", async () => {
    const { client } = clientWith(new Error("ECONNRESET"));

    const result = await client.fetchGames(2024, 1);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.message).toContain("ECONNRESET");
  });

  it("returns a ScrapeError when the response shape fails schema validation", async () => {
    // id must be a number — passing a string breaks the schema
    const invalidPayload = { games: [{ ...VALID_GAME, id: "not-a-number" }] };
    const { client } = clientWith(new Response(JSON.stringify(invalidPayload), { status: 200 }));

    const result = await client.fetchGames(2024, 1);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.message).toMatch(/^Invalid Squiggle games response/);
  });
});

describe("SquiggleClient.fetchStandings", () => {
  it("returns parsed standings on a valid response", async () => {
    const { client } = clientWith(
      new Response(JSON.stringify({ standings: [VALID_STANDING] }), { status: 200 }),
    );

    const result = await client.fetchStandings(2024);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.standings).toHaveLength(1);
    expect(result.data.standings[0]?.name).toBe("Sydney");
  });

  it("returns a ScrapeError on a non-ok response", async () => {
    const { client } = clientWith(new Response("Not Found", { status: 404 }));

    const result = await client.fetchStandings(2024);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.message).toContain("404");
  });

  it("returns a ScrapeError when the standings shape fails schema validation", async () => {
    // rank must be a number — passing a string breaks the schema
    const invalidPayload = { standings: [{ ...VALID_STANDING, rank: "first" }] };
    const { client } = clientWith(new Response(JSON.stringify(invalidPayload), { status: 200 }));

    const result = await client.fetchStandings(2024);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ScrapeError);
    expect(result.error.message).toMatch(/^Invalid Squiggle standings response/);
  });
});
