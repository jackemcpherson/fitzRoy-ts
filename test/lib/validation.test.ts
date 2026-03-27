import { describe, expect, it } from "vitest";
import {
  AflApiTokenSchema,
  CfsMatchSchema,
  CompetitionListSchema,
  MatchRosterSchema,
  PlayerGameStatsSchema,
  RoundListSchema,
  SquadListSchema,
  TeamItemSchema,
} from "../../src/lib/validation";

/**
 * Schema rejection tests — guard against accidental loosening of required fields.
 *
 * "Parses valid X" tests are omitted: asserting `parse(input).toEqual(input)`
 * only tests Zod's passthrough behaviour, not project logic.
 */

describe("Schema rejection tests", () => {
  it("AflApiTokenSchema rejects missing token", () => {
    expect(() => AflApiTokenSchema.parse({ disclaimer: "text" })).toThrow();
  });

  it("CompetitionListSchema rejects missing competitions array", () => {
    expect(() => CompetitionListSchema.parse({})).toThrow();
  });

  it("RoundListSchema rejects a round without roundNumber", () => {
    expect(() => RoundListSchema.parse({ rounds: [{ id: 1146, name: "Round 1" }] })).toThrow();
  });

  it("CfsMatchSchema rejects missing matchId", () => {
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

  it("MatchRosterSchema rejects missing match", () => {
    expect(() => MatchRosterSchema.parse({ teamPlayers: [] })).toThrow();
  });

  it("SquadListSchema rejects missing player object", () => {
    expect(() => SquadListSchema.parse({ squad: { players: [{ jumperNumber: 4 }] } })).toThrow();
  });

  it("TeamItemSchema rejects missing id", () => {
    expect(() => TeamItemSchema.parse({ name: "Richmond" })).toThrow();
  });

  it("TeamItemSchema rejects wrong type for id", () => {
    expect(() => TeamItemSchema.parse({ id: "not-a-number", name: "Richmond" })).toThrow();
  });
});

describe("PlayerGameStatsSchema", () => {
  it("parses with all optional fields missing", () => {
    expect(PlayerGameStatsSchema.parse({})).toEqual({});
  });
});
