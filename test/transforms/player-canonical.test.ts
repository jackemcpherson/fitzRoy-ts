import { describe, expect, it } from "vitest";
import { squadToPlayerDetails } from "../../src/transforms/player-details";
import type { Player, Squad } from "../../src/types";

const samplePlayer: Player = {
  playerId: "p1",
  givenName: "Isaac",
  surname: "Heeney",
  displayName: "Isaac Heeney",
  jumperNumber: 5,
  position: "MIDFIELDER",
  dateOfBirth: "1996-04-04",
  heightCm: 185,
  weightKg: 87,
  draftYear: 2014,
  draftPosition: 18,
  draftType: "national",
  debutYear: 2015,
  recruitedFrom: "Newcastle",
  gamesPlayed: null,
  goals: null,
  team: "Sydney Swans",
  competition: "AFLM",
  source: "afl-api",
};

const sampleSquad: Squad = {
  teamId: "1",
  teamName: "Sydney Swans",
  season: 2024,
  competition: "AFLM",
  players: [samplePlayer],
};

describe("canonical Player (#96)", () => {
  it("Squad.players is the Player canonical shape", () => {
    const first = sampleSquad.players[0];
    expect(first).toBeDefined();
    if (!first) return;
    // Per-row stamped provenance
    expect(first.team).toBe("Sydney Swans");
    expect(first.competition).toBe("AFLM");
    expect(first.source).toBe("afl-api");
    // Bio fields nullable but typed (string ISO 8601, not Date)
    expect(typeof first.dateOfBirth).toBe("string");
    expect(first.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Career counters present (nullable for AFL API source)
    expect(first.gamesPlayed).toBeNull();
    expect(first.goals).toBeNull();
  });

  it("squadToPlayerDetails passes Player[] through with overridden source", () => {
    const projected = squadToPlayerDetails(sampleSquad, "footywire");
    expect(projected).toHaveLength(1);
    expect(projected[0]?.source).toBe("footywire");
    expect(projected[0]?.team).toBe("Sydney Swans");
    expect(projected[0]?.playerId).toBe("p1");
  });
});
