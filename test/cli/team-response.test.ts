import { describe, expect, it } from "vitest";
import { formatJson, formatOutput } from "../../src/cli/formatters/index";
import type { Lineup, Squad, Team, TeamResponse } from "../../src/types";

const sampleTeams: Team[] = [
  { teamId: "1", name: "Sydney Swans", abbreviation: "SYD", competition: "AFLM" },
  { teamId: "2", name: "Carlton", abbreviation: "CAR", competition: "AFLM" },
];

const sampleSquad: Squad = {
  teamId: "1",
  teamName: "Sydney Swans",
  season: 2024,
  scope: "all-time",
  competition: "AFLM",
  players: [
    {
      playerId: "p1",
      givenName: "Isaac",
      surname: "Heeney",
      displayName: "Isaac Heeney",
      jumperNumber: 5,
      position: "Midfielder",
      dateOfBirth: null,
      heightCm: 185,
      weightKg: 87,
      draftYear: 2014,
      draftPosition: 18,
      draftType: "national",
      debutYear: 2015,
      recruitedFrom: null,
    },
  ],
};

const sampleLineup: Lineup = {
  matchId: "M1",
  season: 2024,
  roundNumber: 1,
  homeTeam: "Sydney Swans",
  awayTeam: "Melbourne",
  competition: "AFLM",
  homePlayers: [],
  awayPlayers: [],
};

describe("team verb discriminated union (#99)", () => {
  it("list mode JSON wraps teams in { mode: 'list', teams }", () => {
    const response: TeamResponse = { mode: "list", teams: sampleTeams };
    const parsed = JSON.parse(formatJson(response));
    expect(parsed.mode).toBe("list");
    expect(parsed.teams).toHaveLength(2);
    expect(parsed.teams[0].name).toBe("Sydney Swans");
  });

  it("squad mode JSON wraps Squad envelope (preserves teamId/teamName/season/competition)", () => {
    const response: TeamResponse = { mode: "squad", squad: sampleSquad };
    const parsed = JSON.parse(formatJson(response));
    expect(parsed.mode).toBe("squad");
    expect(parsed.squad.teamId).toBe("1");
    expect(parsed.squad.teamName).toBe("Sydney Swans");
    expect(parsed.squad.season).toBe(2024);
    expect(parsed.squad.scope).toBe("all-time");
    expect(parsed.squad.competition).toBe("AFLM");
    expect(parsed.squad.players).toHaveLength(1);
  });

  it("lineup mode JSON wraps lineups in { mode: 'lineup', lineups }", () => {
    const response: TeamResponse = { mode: "lineup", lineups: [sampleLineup] };
    const parsed = JSON.parse(formatJson(response));
    expect(parsed.mode).toBe("lineup");
    expect(parsed.lineups).toHaveLength(1);
    expect(parsed.lineups[0].matchId).toBe("M1");
    expect(parsed.lineups[0].homePlayers).toEqual([]);
  });

  it("table/CSV paths flatten to inner arrays (no envelope keys)", () => {
    const csv = formatOutput(sampleTeams as readonly object[], { format: "csv" });
    const headers = csv.split("\n")[0] ?? "";
    expect(headers).toContain("name");
    expect(headers).toContain("abbreviation");
    expect(headers).not.toContain("mode");
    expect(headers).not.toContain("teams");
  });
});
