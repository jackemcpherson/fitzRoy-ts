import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { aflTablesSquadSource } from "../../../src/sources/adapters/afl-tables";
import { footyWireSquadSource } from "../../../src/sources/adapters/footywire";
import { AflTables } from "../../../src/sources/afl-tables";
import { FootyWire } from "../../../src/sources/footywire";
import { unexpectedCall } from "../../support/services";

/** A FootyWire service whose player list is empty. */
const emptyFootyWire = Layer.succeed(FootyWire, {
  fetchPage: unexpectedCall("fetchPage"),
  fetchSeasonResults: unexpectedCall("fetchSeasonResults"),
  fetchMatchPlayerStats: unexpectedCall("fetchMatchPlayerStats"),
  fetchSeasonMatchIds: unexpectedCall("fetchSeasonMatchIds"),
  fetchPlayerList: () => Effect.succeed([]),
  fetchSeasonFixture: unexpectedCall("fetchSeasonFixture"),
  fetchTeamStats: unexpectedCall("fetchTeamStats"),
});

/** An AFL Tables service whose player list is empty. */
const emptyAflTables = Layer.succeed(AflTables, {
  fetchSeasonResults: unexpectedCall("fetchSeasonResults"),
  fetchSeasonPlayerStats: unexpectedCall("fetchSeasonPlayerStats"),
  fetchTeamStats: unexpectedCall("fetchTeamStats"),
  fetchPlayerList: () => Effect.succeed([]),
});

describe("scraped squad scope", () => {
  it.effect.each([
    ["footywire", footyWireSquadSource.pipe(Effect.provide(emptyFootyWire))],
    ["afl-tables", aflTablesSquadSource.pipe(Effect.provide(emptyAflTables))],
  ] as const)("stamps %s squads as all-time", ([source, adapter]) =>
    Effect.gen(function* () {
      const squad = yield* (yield* adapter).fetchSquad({
        source,
        team: "Carlton",
        season: 2024,
        competition: "AFLM",
      });

      expect(squad.scope).toBe("all-time");
      expect(squad.season).toBe(2024);
    }),
  );
});
