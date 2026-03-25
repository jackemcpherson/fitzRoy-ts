import { describe, expect, it } from "vitest";
import {
  AflApiTokenSchema,
  CompetitionListSchema,
  CompseasonListSchema,
  MatchDetailSchema,
  MatchItemListSchema,
  MatchItemSchema,
  MatchRosterSchema,
  MatchTeamSchema,
  PeriodScoreSchema,
  PlayerStatsItemSchema,
  PlayerStatsListSchema,
  RoundListSchema,
  SquadListSchema,
  TeamItemSchema,
  TeamListSchema,
} from "../../src/lib/validation";

describe("AflApiTokenSchema", () => {
  it("parses a valid token response", () => {
    const data = {
      access_token: "abc123",
      token_type: "Bearer",
      expires_in: 3600,
    };
    expect(AflApiTokenSchema.parse(data)).toEqual(data);
  });

  it("passes through extra fields", () => {
    const data = {
      access_token: "abc123",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "read",
    };
    expect(AflApiTokenSchema.parse(data)).toEqual(data);
  });

  it("rejects missing access_token", () => {
    expect(() => AflApiTokenSchema.parse({ token_type: "Bearer", expires_in: 3600 })).toThrow();
  });
});

describe("CompetitionListSchema", () => {
  it("parses a valid competition list", () => {
    const data = {
      competitions: [
        { id: "1", name: "AFL Premiership", code: "AFLM" },
        { id: "2", name: "AFL Womens", code: "AFLW" },
      ],
    };
    expect(CompetitionListSchema.parse(data)).toEqual(data);
  });

  it("rejects missing competitions array", () => {
    expect(() => CompetitionListSchema.parse({})).toThrow();
  });
});

describe("CompseasonListSchema", () => {
  it("parses a valid compseason list", () => {
    const data = {
      compseasons: [
        { id: "101", name: "2024 Toyota AFL Premiership Season" },
        { id: "102", name: "2023 Toyota AFL Premiership Season", year: "2023" },
      ],
    };
    expect(CompseasonListSchema.parse(data)).toEqual(data);
  });
});

describe("RoundListSchema", () => {
  it("parses a valid round list", () => {
    const data = {
      rounds: [
        {
          id: "201",
          name: "Round 1",
          roundNumber: 1,
          utcStartTime: "2024-03-14T06:20:00.000Z",
        },
        { id: "202", name: "Round 2", roundNumber: 2 },
      ],
    };
    expect(RoundListSchema.parse(data)).toEqual(data);
  });

  it("rejects a round without roundNumber", () => {
    const data = {
      rounds: [{ id: "201", name: "Round 1" }],
    };
    expect(() => RoundListSchema.parse(data)).toThrow();
  });
});

describe("PeriodScoreSchema", () => {
  it("parses a valid period score", () => {
    const data = {
      periodNumber: 1,
      periodGoals: 3,
      periodBehinds: 2,
      periodScore: 20,
    };
    expect(PeriodScoreSchema.parse(data)).toEqual(data);
  });
});

describe("MatchTeamSchema", () => {
  it("parses a team with score and period scores", () => {
    const data = {
      teamId: "t1",
      teamName: "Richmond",
      score: { goals: 10, behinds: 8, totalScore: 68 },
      periodScore: [{ periodNumber: 1, periodGoals: 3, periodBehinds: 2, periodScore: 20 }],
    };
    expect(MatchTeamSchema.parse(data)).toEqual(data);
  });

  it("parses a team without score (upcoming match)", () => {
    const data = { teamId: "t1", teamName: "Richmond" };
    expect(MatchTeamSchema.parse(data)).toEqual(data);
  });
});

describe("MatchItemSchema", () => {
  const validMatch = {
    matchProviderId: "CD_M20240140101",
    roundNumber: 1,
    status: "C",
    utcStartTime: "2024-03-14T06:20:00.000Z",
    venue: { name: "MCG" },
    homeTeam: {
      teamId: "t1",
      teamName: "Richmond",
      score: { goals: 10, behinds: 8, totalScore: 68 },
    },
    awayTeam: {
      teamId: "t2",
      teamName: "Carlton",
      score: { goals: 12, behinds: 5, totalScore: 77 },
    },
    attendance: 85000,
  };

  it("parses a valid match item", () => {
    expect(MatchItemSchema.parse(validMatch)).toEqual(validMatch);
  });

  it("parses without optional venue and attendance", () => {
    const { venue, attendance, ...minimal } = validMatch;
    expect(MatchItemSchema.parse(minimal)).toEqual(minimal);
  });

  it("rejects missing matchProviderId", () => {
    const { matchProviderId, ...invalid } = validMatch;
    expect(() => MatchItemSchema.parse(invalid)).toThrow();
  });
});

describe("MatchItemListSchema", () => {
  it("parses a list of match items", () => {
    const data = {
      items: [
        {
          matchProviderId: "CD_M1",
          roundNumber: 1,
          status: "C",
          utcStartTime: "2024-03-14T06:20:00.000Z",
          homeTeam: { teamId: "t1", teamName: "Richmond" },
          awayTeam: { teamId: "t2", teamName: "Carlton" },
        },
      ],
    };
    expect(MatchItemListSchema.parse(data)).toEqual(data);
  });

  it("parses an empty items list", () => {
    expect(MatchItemListSchema.parse({ items: [] })).toEqual({ items: [] });
  });
});

describe("MatchDetailSchema", () => {
  it("parses a match detail with compSeason and round", () => {
    const data = {
      matchProviderId: "CD_M1",
      roundNumber: 1,
      status: "C",
      utcStartTime: "2024-03-14T06:20:00.000Z",
      homeTeam: { teamId: "t1", teamName: "Richmond" },
      awayTeam: { teamId: "t2", teamName: "Carlton" },
      compSeason: { id: "cs1", name: "2024 Season" },
      round: { id: "r1", name: "Round 1", roundNumber: 1 },
    };
    expect(MatchDetailSchema.parse(data)).toEqual(data);
  });
});

describe("PlayerStatsItemSchema", () => {
  it("parses a valid player stats item with prefixed fields", () => {
    const data = {
      playerId: "p1",
      teamId: "t1",
      teamName: "Richmond",
      "playerName.givenName": "Dustin",
      "playerName.surname": "Martin",
      "playerName.displayName": "Dustin Martin",
      jumperNumber: 4,
      "playerStats.kicks": 20,
      "playerStats.handballs": 10,
      "playerStats.disposals": 30,
      "playerStats.goals": 3,
      "playerStats.dreamTeamPoints": 120,
    };
    expect(PlayerStatsItemSchema.parse(data)).toEqual(data);
  });

  it("parses with only required fields", () => {
    const data = { playerId: "p1", teamId: "t1" };
    expect(PlayerStatsItemSchema.parse(data)).toEqual(data);
  });

  it("rejects missing playerId", () => {
    expect(() => PlayerStatsItemSchema.parse({ teamId: "t1" })).toThrow();
  });
});

describe("PlayerStatsListSchema", () => {
  it("parses a player stats list response", () => {
    const data = {
      items: [
        { playerId: "p1", teamId: "t1", "playerStats.kicks": 20 },
        { playerId: "p2", teamId: "t1", "playerStats.kicks": 15 },
      ],
    };
    expect(PlayerStatsListSchema.parse(data)).toEqual(data);
  });
});

describe("MatchRosterSchema", () => {
  it("parses a valid match roster", () => {
    const data = {
      homeTeam: {
        teamId: "t1",
        teamName: "Richmond",
        players: [
          {
            playerId: "p1",
            playerName: { givenName: "Dustin", surname: "Martin" },
            jumperNumber: 4,
            position: "Forward",
          },
        ],
      },
      awayTeam: {
        teamId: "t2",
        teamName: "Carlton",
        players: [
          {
            playerId: "p2",
            playerName: {
              givenName: "Patrick",
              surname: "Cripps",
              displayName: "Patrick Cripps",
            },
            isEmergency: false,
            isSubstitute: false,
          },
        ],
      },
    };
    expect(MatchRosterSchema.parse(data)).toEqual(data);
  });

  it("rejects missing homeTeam", () => {
    const data = {
      awayTeam: { teamId: "t2", teamName: "Carlton", players: [] },
    };
    expect(() => MatchRosterSchema.parse(data)).toThrow();
  });
});

describe("TeamListSchema", () => {
  it("parses a valid team list", () => {
    const data = {
      teams: [
        {
          id: "t1",
          name: "Richmond",
          abbreviation: "RICH",
          teamType: "club",
        },
      ],
    };
    expect(TeamListSchema.parse(data)).toEqual(data);
  });

  it("parses a team with only required fields", () => {
    const data = {
      teams: [{ id: "t1", name: "Richmond" }],
    };
    expect(TeamListSchema.parse(data)).toEqual(data);
  });
});

describe("SquadListSchema", () => {
  it("parses a valid squad response", () => {
    const data = {
      squad: [
        {
          playerId: "p1",
          playerName: { givenName: "Dustin", surname: "Martin" },
          jumperNumber: 4,
          position: "Forward",
          dateOfBirth: "1991-06-26",
          heightCm: 185,
          weightKg: 85,
        },
      ],
    };
    expect(SquadListSchema.parse(data)).toEqual(data);
  });

  it("parses a squad player with only required fields", () => {
    const data = {
      squad: [
        {
          playerId: "p1",
          playerName: { givenName: "Dustin", surname: "Martin" },
        },
      ],
    };
    expect(SquadListSchema.parse(data)).toEqual(data);
  });

  it("rejects missing playerName", () => {
    const data = {
      squad: [{ playerId: "p1" }],
    };
    expect(() => SquadListSchema.parse(data)).toThrow();
  });
});

describe("TeamItemSchema", () => {
  it("rejects missing id", () => {
    expect(() => TeamItemSchema.parse({ name: "Richmond" })).toThrow();
  });

  it("rejects wrong type for id", () => {
    expect(() => TeamItemSchema.parse({ id: 123, name: "Richmond" })).toThrow();
  });
});
