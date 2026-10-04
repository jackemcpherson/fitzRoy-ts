import { describe, expect, it } from "vitest";
import type { MatchRoster } from "../../src/lib/validation";
import { transformMatchRoster } from "../../src/transforms/lineup";
import capturedRoster from "../fixtures/grand-final-2026-roster.json";

function makeRoster(overrides?: Partial<MatchRoster>): MatchRoster {
  return {
    match: {
      matchId: "CD_M1",
      status: "CONCLUDED",
      utcStartTime: "2025-03-13T08:30:00",
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
          {
            player: {
              position: "INT",
              player: {
                playerId: "CD_I2",
                playerName: { givenName: "Jack", surname: "Ross" },
              },
            },
            jumperNumber: 25,
          },
        ],
      },
      {
        teamId: "CD_T30",
        players: [
          {
            player: {
              position: "MID",
              player: {
                playerId: "CD_I3",
                playerName: { givenName: "Patrick", surname: "Cripps" },
              },
            },
            jumperNumber: 9,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("transformMatchRoster", () => {
  it("transforms roster into a Lineup", () => {
    const lineup = transformMatchRoster(makeRoster(), 2025, 1, "AFLM");

    expect(lineup.matchId).toBe("CD_M1");
    expect(lineup.season).toBe(2025);
    expect(lineup.roundNumber).toBe(1);
    expect(lineup.homeTeam).toBe("Richmond");
    expect(lineup.awayTeam).toBe("Carlton");
    expect(lineup.competition).toBe("AFLM");
  });

  it("maps home and away players correctly", () => {
    const lineup = transformMatchRoster(makeRoster(), 2025, 1, "AFLM");

    expect(lineup.homePlayers).toHaveLength(2);
    expect(lineup.awayPlayers).toHaveLength(1);
    expect(lineup.homePlayers[0]?.playerId).toBe("CD_I1");
    expect(lineup.awayPlayers[0]?.playerId).toBe("CD_I3");
  });

  it("extracts player identity fields", () => {
    const lineup = transformMatchRoster(makeRoster(), 2025, 1, "AFLM");
    const p = lineup.homePlayers[0];

    expect(p?.givenName).toBe("Dustin");
    expect(p?.surname).toBe("Martin");
    expect(p?.displayName).toBe("Dustin Martin");
    expect(p?.jumperNumber).toBe(4);
    expect(p?.matchPosition).toBe("FWD");
  });

  it("keeps interchange players separate from substitutes", () => {
    const lineup = transformMatchRoster(makeRoster(), 2025, 1, "AFLM");
    const fwd = lineup.homePlayers[0];
    const int = lineup.homePlayers[1];

    expect(fwd?.isSubstitute).toBe(false);
    expect(fwd?.isEmergency).toBe(false);
    expect(int?.isSubstitute).toBe(false);
    expect(int?.isEmergency).toBe(false);
  });

  it("recognises an explicit substitute designation", () => {
    const roster = makeRoster();
    const player = roster.teamPlayers[0]?.players[1];
    if (!player) throw new Error("Missing fixture participant");
    player.player.position = "SUB";
    const lineup = transformMatchRoster(roster, 2025, 1, "AFLM");
    expect(lineup.homePlayers[1]?.isSubstitute).toBe(true);
    expect(lineup.homePlayers[1]?.isEmergency).toBe(false);
  });

  it("identifies emergency positions", () => {
    const roster = makeRoster();
    const homeTeam = roster.teamPlayers[0];
    if (homeTeam) {
      homeTeam.players.push({
        player: {
          position: "EMG",
          player: {
            playerId: "CD_I99",
            playerName: { givenName: "Test", surname: "Emergency" },
          },
        },
        jumperNumber: 99,
      });
    }
    const lineup = transformMatchRoster(roster, 2025, 1, "AFLM");
    const emg = lineup.homePlayers[2];

    expect(emg?.isEmergency).toBe(true);
    expect(emg?.isSubstitute).toBe(false);
  });

  it("normalises team names", () => {
    const roster = makeRoster();
    roster.match.homeTeam.name = "GWS Giants";
    roster.match.awayTeam.name = "Footscray";
    const lineup = transformMatchRoster(roster, 2025, 1, "AFLM");

    expect(lineup.homeTeam).toBe("GWS Giants");
    expect(lineup.awayTeam).toBe("Western Bulldogs");
  });

  it("handles missing jumper number", () => {
    const roster = makeRoster();
    const homeTeam = roster.teamPlayers[0];
    if (homeTeam?.players[0]) {
      (homeTeam.players[0] as Record<string, unknown>).jumperNumber = undefined;
    }
    const lineup = transformMatchRoster(roster, 2025, 1, "AFLM");

    expect(lineup.homePlayers[0]?.jumperNumber).toBeNull();
  });

  it("handles empty team players", () => {
    const roster = makeRoster();
    roster.teamPlayers = [];
    const lineup = transformMatchRoster(roster, 2025, 1, "AFLM");

    expect(lineup.homePlayers).toEqual([]);
    expect(lineup.awayPlayers).toEqual([]);
  });
});

it("keeps the captured Grand Final's ten interchange players out of substitute counts", () => {
  const lineup = transformMatchRoster(capturedRoster, 2026, 29, "AFLM");
  const players = [...lineup.homePlayers, ...lineup.awayPlayers];
  expect(players.filter((player) => player.matchPosition === "INT")).toHaveLength(10);
  expect(players.filter((player) => player.isSubstitute)).toHaveLength(0);
  expect(players.filter((player) => player.isEmergency)).toHaveLength(6);
  expect(players.filter((player) => !player.isEmergency)).toHaveLength(46);
});
