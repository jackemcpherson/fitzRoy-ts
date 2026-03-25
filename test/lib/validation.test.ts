import { describe, expect, it } from "vitest";
import {
  AflApiTokenSchema,
  CfsMatchSchema,
  CfsScoreSchema,
  CompetitionListSchema,
  CompseasonListSchema,
  MatchItemListSchema,
  MatchItemSchema,
  MatchRosterSchema,
  PeriodScoreSchema,
  PlayerGameStatsSchema,
  PlayerStatsItemSchema,
  PlayerStatsListSchema,
  RoundListSchema,
  ScoreSchema,
  SquadListSchema,
  TeamItemSchema,
  TeamListSchema,
  TeamPlayersSchema,
  TeamScoreSchema,
} from "../../src/lib/validation";

describe("AflApiTokenSchema", () => {
  it("parses a valid token response", () => {
    const data = {
      token: "abc123",
      disclaimer: "Some disclaimer text",
    };
    expect(AflApiTokenSchema.parse(data)).toEqual(data);
  });

  it("passes through extra fields", () => {
    const data = {
      token: "abc123",
      disclaimer: "Some disclaimer",
      extra: "field",
    };
    expect(AflApiTokenSchema.parse(data)).toEqual(data);
  });

  it("rejects missing token", () => {
    expect(() => AflApiTokenSchema.parse({ disclaimer: "text" })).toThrow();
  });
});

describe("CompetitionListSchema", () => {
  it("parses a valid competition list", () => {
    const data = {
      competitions: [
        { id: 1, name: "AFL Premiership", code: "AFL" },
        { id: 3, name: "NAB AFLW", code: "AFLW" },
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
      compSeasons: [
        { id: 62, name: "2024 Toyota AFL Premiership" },
        { id: 52, name: "2023 Toyota AFL Premiership", currentRoundNumber: 24 },
      ],
    };
    expect(CompseasonListSchema.parse(data)).toEqual(data);
  });
});

describe("RoundListSchema", () => {
  it("parses a valid round list with providerId", () => {
    const data = {
      rounds: [
        {
          id: 1146,
          providerId: "CD_R202501400",
          name: "Round 1",
          roundNumber: 1,
          utcStartTime: "2024-03-14T06:20:00.000Z",
        },
        { id: 1147, name: "Round 2", roundNumber: 2 },
      ],
    };
    expect(RoundListSchema.parse(data)).toEqual(data);
  });

  it("rejects a round without roundNumber", () => {
    const data = {
      rounds: [{ id: 1146, name: "Round 1" }],
    };
    expect(() => RoundListSchema.parse(data)).toThrow();
  });
});

describe("ScoreSchema", () => {
  it("parses a valid score", () => {
    const data = { totalScore: 82, goals: 13, behinds: 4, superGoals: null };
    expect(ScoreSchema.parse(data)).toEqual(data);
  });
});

describe("PeriodScoreSchema", () => {
  it("parses a valid period score", () => {
    const data = {
      periodNumber: 1,
      score: { totalScore: 7, goals: 1, behinds: 1, superGoals: null },
    };
    expect(PeriodScoreSchema.parse(data)).toEqual(data);
  });
});

describe("TeamScoreSchema", () => {
  it("parses a team score with period breakdown", () => {
    const data = {
      matchScore: { totalScore: 82, goals: 13, behinds: 4 },
      periodScore: [
        { periodNumber: 1, score: { totalScore: 7, goals: 1, behinds: 1 } },
        { periodNumber: 2, score: { totalScore: 18, goals: 3, behinds: 0 } },
      ],
      rushedBehinds: 2,
      minutesInFront: 32,
    };
    expect(TeamScoreSchema.parse(data)).toEqual(data);
  });
});

describe("CfsMatchSchema", () => {
  it("parses a valid /cfs/ match object", () => {
    const data = {
      matchId: "CD_M20250140101",
      name: "Richmond Vs Carlton",
      status: "CONCLUDED",
      utcStartTime: "2025-03-13T08:30:00",
      homeTeamId: "CD_T120",
      awayTeamId: "CD_T30",
      homeTeam: { name: "Richmond", teamId: "CD_T120", abbr: "RICH", nickname: "Tigers" },
      awayTeam: { name: "Carlton", teamId: "CD_T30", abbr: "CARL", nickname: "Blues" },
    };
    expect(CfsMatchSchema.parse(data)).toEqual(data);
  });

  it("rejects missing matchId", () => {
    expect(() =>
      CfsMatchSchema.parse({
        status: "CONCLUDED",
        utcStartTime: "2025-03-13",
        homeTeamId: "t1",
        awayTeamId: "t2",
        homeTeam: { name: "A", teamId: "t1" },
        awayTeam: { name: "B", teamId: "t2" },
      }),
    ).toThrow();
  });
});

describe("MatchItemSchema", () => {
  const validItem = {
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
      homeTeamScore: {
        matchScore: { totalScore: 82, goals: 13, behinds: 4 },
      },
      awayTeamScore: {
        matchScore: { totalScore: 69, goals: 9, behinds: 15 },
      },
    },
    venue: { name: "MCG" },
    round: { name: "Round 1", roundId: "CD_R202501401", roundNumber: 1 },
  };

  it("parses a valid match item", () => {
    expect(MatchItemSchema.parse(validItem)).toEqual(validItem);
  });

  it("parses without optional score and venue", () => {
    const { score, venue, round, ...minimal } = validItem;
    expect(MatchItemSchema.parse(minimal)).toEqual(minimal);
  });
});

describe("MatchItemListSchema", () => {
  it("parses a list of match items", () => {
    const data = {
      roundId: "CD_R202501401",
      items: [
        {
          match: {
            matchId: "CD_M1",
            status: "CONCLUDED",
            utcStartTime: "2025-03-13",
            homeTeamId: "t1",
            awayTeamId: "t2",
            homeTeam: { name: "Richmond", teamId: "t1" },
            awayTeam: { name: "Carlton", teamId: "t2" },
          },
        },
      ],
    };
    expect(MatchItemListSchema.parse(data)).toEqual(data);
  });

  it("parses an empty items list", () => {
    expect(MatchItemListSchema.parse({ items: [] })).toEqual({ items: [] });
  });
});

describe("CfsScoreSchema", () => {
  it("parses a full score with period breakdown", () => {
    const data = {
      status: "CONCLUDED",
      matchId: "CD_M1",
      homeTeamScore: {
        matchScore: { totalScore: 82, goals: 13, behinds: 4 },
        periodScore: [{ periodNumber: 1, score: { totalScore: 7, goals: 1, behinds: 1 } }],
      },
      awayTeamScore: {
        matchScore: { totalScore: 69, goals: 9, behinds: 15 },
      },
    };
    expect(CfsScoreSchema.parse(data)).toEqual(data);
  });
});

describe("PlayerGameStatsSchema", () => {
  it("parses player game stats with nested clearances", () => {
    const data = {
      goals: 2.0,
      kicks: 15.0,
      disposals: 22.0,
      clearances: {
        centreClearances: 1.0,
        stoppageClearances: 2.0,
        totalClearances: 3.0,
      },
    };
    expect(PlayerGameStatsSchema.parse(data)).toEqual(data);
  });

  it("parses with all optional fields missing", () => {
    expect(PlayerGameStatsSchema.parse({})).toEqual({});
  });
});

describe("PlayerStatsItemSchema", () => {
  it("parses a valid player stats item with nested structure", () => {
    const data = {
      player: {
        player: {
          position: "INT",
          player: {
            playerId: "CD_I1028525",
            playerName: { givenName: "Harry", surname: "Armstrong" },
            captain: false,
            playerJumperNumber: 34,
          },
        },
        jumperNumber: 34,
      },
      teamId: "CD_T120",
      playerStats: {
        stats: {
          goals: 0.0,
          kicks: 2.0,
          disposals: 5.0,
        },
      },
    };
    expect(PlayerStatsItemSchema.parse(data)).toEqual(data);
  });
});

describe("PlayerStatsListSchema", () => {
  it("parses a player stats list with home and away arrays", () => {
    const playerEntry = {
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
      playerStats: { stats: { goals: 3.0 } },
    };
    const data = {
      homeTeamPlayerStats: [playerEntry],
      awayTeamPlayerStats: [playerEntry],
    };
    expect(PlayerStatsListSchema.parse(data)).toEqual(data);
  });
});

describe("TeamPlayersSchema", () => {
  it("parses a team players entry", () => {
    const data = {
      teamId: "CD_T120",
      players: [
        {
          player: {
            position: "BPL",
            player: {
              playerId: "CD_I1002403",
              playerName: { givenName: "Ben", surname: "Miller" },
            },
          },
          jumperNumber: 12,
        },
      ],
    };
    expect(TeamPlayersSchema.parse(data)).toEqual(data);
  });
});

describe("MatchRosterSchema", () => {
  it("parses a valid match roster", () => {
    const data = {
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
        {
          teamId: "CD_T120",
          players: [
            {
              player: {
                position: "FWD",
                player: {
                  playerId: "CD_I1",
                  playerName: { givenName: "Dustin", surname: "Martin" },
                },
              },
              jumperNumber: 4,
            },
          ],
        },
        {
          teamId: "CD_T30",
          players: [],
        },
      ],
    };
    expect(MatchRosterSchema.parse(data)).toEqual(data);
  });

  it("rejects missing match", () => {
    expect(() =>
      MatchRosterSchema.parse({
        teamPlayers: [],
      }),
    ).toThrow();
  });
});

describe("TeamListSchema", () => {
  it("parses a valid team list", () => {
    const data = {
      teams: [
        {
          id: 1,
          name: "Richmond",
          abbreviation: "RICH",
          teamType: "MEN",
        },
      ],
    };
    expect(TeamListSchema.parse(data)).toEqual(data);
  });

  it("parses a team with only required fields", () => {
    const data = {
      teams: [{ id: 1, name: "Richmond" }],
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
    expect(() => TeamItemSchema.parse({ id: "not-a-number", name: "Richmond" })).toThrow();
  });
});
