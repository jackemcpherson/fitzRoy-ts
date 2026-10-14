import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  AflApiTokenSchema,
  CfsMatchSchema,
  CfsVenueSchema,
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
    expect(() => Schema.decodeUnknownSync(AflApiTokenSchema)({ disclaimer: "text" })).toThrow();
  });

  it("CompetitionListSchema rejects missing competitions array", () => {
    expect(() => Schema.decodeUnknownSync(CompetitionListSchema)({})).toThrow();
  });

  it("RoundListSchema rejects a round without roundNumber", () => {
    expect(() =>
      Schema.decodeUnknownSync(RoundListSchema)({ rounds: [{ id: 1146, name: "Round 1" }] }),
    ).toThrow();
  });

  it("CfsMatchSchema rejects missing matchId", () => {
    expect(() =>
      Schema.decodeUnknownSync(CfsMatchSchema)({
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
    expect(() => Schema.decodeUnknownSync(MatchRosterSchema)({ teamPlayers: [] })).toThrow();
  });

  it("SquadListSchema rejects missing player object", () => {
    expect(() =>
      Schema.decodeUnknownSync(SquadListSchema)({ squad: { players: [{ jumperNumber: 4 }] } }),
    ).toThrow();
  });

  it("TeamItemSchema rejects missing id", () => {
    expect(() => Schema.decodeUnknownSync(TeamItemSchema)({ name: "Richmond" })).toThrow();
  });

  it("TeamItemSchema rejects wrong type for id", () => {
    expect(() =>
      Schema.decodeUnknownSync(TeamItemSchema)({ id: "not-a-number", name: "Richmond" }),
    ).toThrow();
  });
});

describe("PlayerGameStatsSchema", () => {
  it("parses with all optional fields missing", () => {
    expect(Schema.decodeUnknownSync(PlayerGameStatsSchema)({})).toEqual({});
  });
});

describe("CfsVenueSchema", () => {
  it("accepts null state, venueId, and timeZone (#127)", () => {
    expect(() =>
      Schema.decodeUnknownSync(CfsVenueSchema)({
        name: "Stadium",
        venueId: null,
        state: null,
        timeZone: null,
      }),
    ).not.toThrow();
  });

  it("rejects missing name", () => {
    expect(() => Schema.decodeUnknownSync(CfsVenueSchema)({ state: "VIC" })).toThrow();
  });
});
