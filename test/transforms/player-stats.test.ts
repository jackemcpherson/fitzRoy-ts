import { describe, expect, it } from "vitest";
import type { PlayerStatsList } from "../../src/lib/validation";
import { transformPlayerStats } from "../../src/transforms/player-stats";

function makePlayerStatsItem(overrides?: Record<string, unknown>) {
  return {
    player: {
      player: {
        position: "FWD",
        player: {
          playerId: "CD_I1",
          playerName: { givenName: "Dustin", surname: "Martin" },
          captain: false,
          playerJumperNumber: 4,
        },
      },
      jumperNumber: 4,
    },
    teamId: "CD_T120",
    playerStats: {
      stats: {
        goals: 3.0,
        behinds: 1.0,
        kicks: 15.0,
        handballs: 8.0,
        disposals: 23.0,
        marks: 5.0,
        tackles: 4.0,
        hitouts: 0.0,
        freesFor: 2.0,
        freesAgainst: 1.0,
        contestedPossessions: 10.0,
        uncontestedPossessions: 13.0,
        contestedMarks: 1.0,
        intercepts: 0.0,
        clearances: {
          centreClearances: 2.0,
          stoppageClearances: 3.0,
          totalClearances: 5.0,
        },
        inside50s: 4.0,
        rebound50s: 1.0,
        clangers: 2.0,
        turnovers: 3.0,
        onePercenters: 0.0,
        bounces: 1.0,
        goalAssists: 2.0,
        disposalEfficiency: 65.0,
        metresGained: 350.0,
        dreamTeamPoints: 120.0,
      },
    },
    ...overrides,
  };
}

function makeStatsList(overrides?: Partial<PlayerStatsList>): PlayerStatsList {
  return {
    homeTeamPlayerStats: [makePlayerStatsItem()],
    awayTeamPlayerStats: [
      makePlayerStatsItem({
        teamId: "CD_T30",
        player: {
          player: {
            position: "MID",
            player: {
              playerId: "CD_I2",
              playerName: { givenName: "Patrick", surname: "Cripps" },
              captain: true,
              playerJumperNumber: 9,
            },
          },
          jumperNumber: 9,
        },
      }),
    ],
    ...overrides,
  };
}

describe("transformPlayerStats", () => {
  it("transforms home and away players with all fields", () => {
    const results = transformPlayerStats(makeStatsList(), "CD_M1", 2025, 1, "AFLM");

    expect(results).toHaveLength(2);

    const r = results[0];
    expect(r).toBeDefined();
    if (!r) return;

    // Player identity
    expect(r.playerId).toBe("CD_I1");
    expect(r.givenName).toBe("Dustin");
    expect(r.surname).toBe("Martin");
    expect(r.displayName).toBe("Dustin Martin");
    expect(r.jumperNumber).toBe(4);

    // Core stats
    expect(r.goals).toBe(3.0);
    expect(r.kicks).toBe(15.0);
    expect(r.disposals).toBe(23.0);
    expect(r.tackles).toBe(4.0);

    // Nested clearances
    expect(r.centreClearances).toBe(2.0);
    expect(r.stoppageClearances).toBe(3.0);
    expect(r.totalClearances).toBe(5.0);

    // Metadata
    expect(r.matchId).toBe("CD_M1");
    expect(r.season).toBe(2025);
    expect(r.roundNumber).toBe(1);
    expect(r.competition).toBe("AFLM");
    expect(r.source).toBe("afl-api");

    // Away player
    expect(results[1]?.playerId).toBe("CD_I2");
  });

  it("handles missing optional stats as null", () => {
    const list: PlayerStatsList = {
      homeTeamPlayerStats: [
        {
          player: {
            player: {
              position: "RK",
              player: {
                playerId: "CD_I99",
                playerName: { givenName: "Joe", surname: "Bloggs" },
              },
            },
            jumperNumber: 99,
          },
          teamId: "CD_T1",
          playerStats: { stats: {} },
        },
      ],
      awayTeamPlayerStats: [],
    };
    const results = transformPlayerStats(list, "CD_M1", 2025, 1, "AFLM");
    const r = results[0];

    expect(r?.kicks).toBeNull();
    expect(r?.goals).toBeNull();
    expect(r?.centreClearances).toBeNull();
    expect(r?.dreamTeamPoints).toBeNull();
  });

  it("returns empty array for empty stats lists", () => {
    const list: PlayerStatsList = {
      homeTeamPlayerStats: [],
      awayTeamPlayerStats: [],
    };
    expect(transformPlayerStats(list, "CD_M1", 2025, 1, "AFLM")).toEqual([]);
  });
});
