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
  token: "test-token-123",
  disclaimer: "Test disclaimer",
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
        headers: { "Content-Length": "0" },
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

      expect(fetchFn).toHaveBeenCalledWith("https://custom.token/endpoint", {
        method: "POST",
        headers: { "Content-Length": "0" },
      });
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

    it("adds x-media-mis-token header to request", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({ data: "test" }));
      const client = new AflApiClient({ fetchFn });

      await client.authedFetch("https://api.afl.com.au/test");

      const secondCall = fetchFn.mock.calls[1];
      const headers = secondCall?.[1]?.headers as Headers;
      expect(headers.get("x-media-mis-token")).toBe("test-token-123");
    });

    it("retries once on 401 by re-authenticating", async () => {
      const freshToken = { ...VALID_TOKEN, token: "refreshed-token" };
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

  describe("resolveCompetitionId", () => {
    it("returns the competition ID for AFLM (mapped to AFL code)", async () => {
      const competitions = {
        competitions: [
          { id: 1, name: "Toyota AFL Premiership", code: "AFL" },
          { id: 3, name: "NAB AFLW", code: "AFLW" },
        ],
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(competitions));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveCompetitionId("AFLM");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(1);
      }
    });

    it("returns error when competition code is not found", async () => {
      const competitions = {
        competitions: [{ id: 1, name: "Toyota AFL Premiership", code: "AFL" }],
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(competitions));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveCompetitionId("AFLW");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AflApiError);
        expect(result.error.message).toContain("AFLW");
      }
    });

    it("propagates fetch errors", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse({}, { status: 500, statusText: "Server Error" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveCompetitionId("AFLM");

      expect(result.success).toBe(false);
    });
  });

  describe("resolveSeasonId", () => {
    it("returns the season ID matching by name containing year", async () => {
      const compseasons = {
        compSeasons: [
          { id: 52, name: "2023 Toyota AFL Premiership" },
          { id: 62, name: "2024 Toyota AFL Premiership" },
        ],
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(compseasons));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveSeasonId(1, 2024);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(62);
      }
    });

    it("returns error when season year is not found", async () => {
      const compseasons = {
        compSeasons: [{ id: 52, name: "2023 Toyota AFL Premiership" }],
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(compseasons));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveSeasonId(1, 2024);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AflApiError);
        expect(result.error.message).toContain("2024");
      }
    });

    it("propagates fetch errors", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse({}, { status: 500, statusText: "Server Error" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveSeasonId(1, 2024);

      expect(result.success).toBe(false);
    });
  });

  describe("resolveRounds", () => {
    it("returns all rounds for a season", async () => {
      const rounds = {
        rounds: [
          {
            id: 1146,
            name: "Round 1",
            roundNumber: 1,
            utcStartTime: "2024-03-14T06:20:00.000Z",
          },
          {
            id: 1147,
            name: "Round 2",
            roundNumber: 2,
            utcStartTime: "2024-03-21T06:20:00.000Z",
          },
        ],
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(rounds));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveRounds(73);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]?.roundNumber).toBe(1);
        expect(result.data[1]?.roundNumber).toBe(2);
      }
    });

    it("returns empty array when no rounds exist", async () => {
      const rounds = { rounds: [] };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(rounds));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveRounds(73);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it("propagates fetch errors", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse({}, { status: 500, statusText: "Server Error" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.resolveRounds(73);

      expect(result.success).toBe(false);
    });
  });

  describe("isAuthenticated", () => {
    it("returns false when no token is cached", () => {
      const client = new AflApiClient({ fetchFn: vi.fn() });
      expect(client.isAuthenticated).toBe(false);
    });

    it("returns true after successful authentication", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockResponse(VALID_TOKEN));
      const client = new AflApiClient({ fetchFn });

      await client.authenticate();

      expect(client.isAuthenticated).toBe(true);
    });
  });

  describe("fetchRoundMatchItems", () => {
    const matchItemsResponse = {
      roundId: "CD_R202501401",
      items: [
        {
          match: {
            matchId: "CD_M20250140101",
            status: "CONCLUDED",
            utcStartTime: "2025-03-13T08:30:00",
            homeTeamId: "CD_T120",
            awayTeamId: "CD_T30",
            homeTeam: { name: "Richmond", teamId: "CD_T120" },
            awayTeam: { name: "Carlton", teamId: "CD_T30" },
          },
          score: {
            status: "CONCLUDED",
            matchId: "CD_M20250140101",
            homeTeamScore: { matchScore: { totalScore: 82, goals: 13, behinds: 4 } },
            awayTeamScore: { matchScore: { totalScore: 69, goals: 9, behinds: 15 } },
          },
          venue: { name: "MCG" },
        },
      ],
    };

    it("returns match items for a round", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse(matchItemsResponse));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchRoundMatchItems("CD_R202501401");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.match.matchId).toBe("CD_M20250140101");
      }
    });

    it("propagates fetch errors", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse({}, { status: 400, statusText: "Bad Request" }));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchRoundMatchItems("invalid");

      expect(result.success).toBe(false);
    });
  });

  describe("fetchRoundMatchItemsByNumber", () => {
    it("resolves round providerId and fetches match items", async () => {
      const rounds = {
        rounds: [{ id: 1147, providerId: "CD_R202501401", name: "Round 1", roundNumber: 1 }],
      };
      const matchItems = {
        roundId: "CD_R202501401",
        items: [
          {
            match: {
              matchId: "CD_M1",
              status: "CONCLUDED",
              utcStartTime: "2025-03-13",
              homeTeamId: "t1",
              awayTeamId: "t2",
              homeTeam: { name: "A", teamId: "t1" },
              awayTeam: { name: "B", teamId: "t2" },
            },
          },
        ],
      };
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(rounds))
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse(matchItems));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchRoundMatchItemsByNumber(73, 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
    });

    it("returns error when round not found", async () => {
      const rounds = {
        rounds: [{ id: 1147, providerId: "CD_R1", name: "Round 1", roundNumber: 1 }],
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(rounds));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchRoundMatchItemsByNumber(73, 99);

      expect(result.success).toBe(false);
    });
  });

  describe("fetchSeasonMatchItems", () => {
    it("aggregates concluded matches from all rounds", async () => {
      const rounds = {
        rounds: [
          { id: 1146, providerId: "CD_R1", name: "Round 1", roundNumber: 1 },
          { id: 1147, providerId: "CD_R2", name: "Round 2", roundNumber: 2 },
        ],
      };
      const round1Items = {
        items: [
          {
            match: {
              matchId: "CD_M1",
              status: "CONCLUDED",
              utcStartTime: "2025-03-13",
              homeTeamId: "t1",
              awayTeamId: "t2",
              homeTeam: { name: "A", teamId: "t1" },
              awayTeam: { name: "B", teamId: "t2" },
            },
          },
        ],
      };
      const round2Items = {
        items: [
          {
            match: {
              matchId: "CD_M2",
              status: "UPCOMING",
              utcStartTime: "2025-03-20",
              homeTeamId: "t3",
              awayTeamId: "t4",
              homeTeam: { name: "C", teamId: "t3" },
              awayTeam: { name: "D", teamId: "t4" },
            },
          },
        ],
      };
      const fetchFn = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("compseasons")) {
          return Promise.resolve(mockResponse(rounds));
        }
        if (typeof url === "string" && url.includes("WMCTok")) {
          return Promise.resolve(mockResponse(VALID_TOKEN));
        }
        if (typeof url === "string" && url.includes("CD_R1")) {
          return Promise.resolve(mockResponse(round1Items));
        }
        if (typeof url === "string" && url.includes("CD_R2")) {
          return Promise.resolve(mockResponse(round2Items));
        }
        return Promise.resolve(mockResponse({}, { status: 404 }));
      });
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchSeasonMatchItems(73);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.match.matchId).toBe("CD_M1");
      }
    });
  });

  describe("fetchPlayerStats", () => {
    it("returns player stats for a match", async () => {
      const playerStats = {
        homeTeamPlayerStats: [
          {
            player: {
              player: {
                position: "FWD",
                player: {
                  playerId: "CD_I1",
                  playerName: { givenName: "Test", surname: "Player" },
                },
              },
              jumperNumber: 1,
            },
            teamId: "CD_T1",
            playerStats: { stats: { goals: 3.0, kicks: 15.0 } },
          },
        ],
        awayTeamPlayerStats: [],
      };
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse(playerStats));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchPlayerStats("CD_M1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.homeTeamPlayerStats).toHaveLength(1);
        expect(result.data.awayTeamPlayerStats).toHaveLength(0);
      }
    });
  });

  describe("fetchMatchRoster", () => {
    it("returns match roster for a match", async () => {
      const roster = {
        match: {
          matchId: "CD_M1",
          status: "CONCLUDED",
          utcStartTime: "2025-03-13",
          homeTeamId: "CD_T120",
          awayTeamId: "CD_T30",
          homeTeam: { name: "Richmond", teamId: "CD_T120" },
          awayTeam: { name: "Carlton", teamId: "CD_T30" },
        },
        teamPlayers: [
          { teamId: "CD_T120", players: [] },
          { teamId: "CD_T30", players: [] },
        ],
      };
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(VALID_TOKEN))
        .mockResolvedValueOnce(mockResponse(roster));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchMatchRoster("CD_M1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teamPlayers).toHaveLength(2);
      }
    });
  });

  describe("fetchTeams", () => {
    it("returns all teams when no filter provided", async () => {
      const teams = {
        teams: [
          { id: 1, name: "Adelaide Crows", teamType: "MEN" },
          { id: 2, name: "Adelaide Crows W", teamType: "WOMEN" },
        ],
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(teams));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchTeams();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it("filters by team type when provided", async () => {
      const teams = {
        teams: [
          { id: 1, name: "Adelaide Crows", teamType: "MEN" },
          { id: 2, name: "Adelaide Crows W", teamType: "WOMEN" },
        ],
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(teams));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchTeams("MEN");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.name).toBe("Adelaide Crows");
      }
    });
  });

  describe("fetchSquad", () => {
    it("returns squad for a team and season", async () => {
      const squad = {
        squad: {
          players: [
            {
              player: {
                id: 1910,
                firstName: "Chris",
                surname: "Burgess",
              },
              jumperNumber: 21,
              position: "KEY_FORWARD",
            },
          ],
        },
      };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(squad));
      const client = new AflApiClient({ fetchFn });

      const result = await client.fetchSquad(1, 73);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.squad.players).toHaveLength(1);
      }
    });
  });
});
