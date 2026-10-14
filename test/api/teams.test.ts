import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fetchTeams } from "../../src/api/teams";
import type { Route } from "../support/http";
import { fixtureFitzroy } from "../support/services";

/**
 * Routes that return an empty AFL `/teams` list. This drives the AFLW
 * backfill path in `src/api/teams.ts`: when the upstream `WOMEN` filter
 * yields zero teams, the four hardcoded AFLW senior clubs (Essendon,
 * Hawthorn, Sydney Swans, Port Adelaide) should be added.
 */
const EMPTY_TEAMS: readonly Route[] = [
  ["/teams", { body: JSON.stringify({ teams: [] }) }],
  [/./, { body: "unexpected URL", status: 500 }],
];

describe("fetchTeams public API", () => {
  it.effect("augments AFLW with the four backfill senior clubs when upstream omits them", () =>
    Effect.gen(function* () {
      const teams = yield* fetchTeams({ competition: "AFLW" });

      const names = teams.map((t) => t.name).sort();
      expect(names).toContain("Essendon");
      expect(names).toContain("Hawthorn");
      expect(names).toContain("Sydney Swans");
      expect(names).toContain("Port Adelaide");
      expect(teams).toHaveLength(4);

      for (const team of teams) {
        expect(team.competition).toBe("AFLW");
        expect(team.source).toBe("afl-api");
      }
    }).pipe(Effect.provide(fixtureFitzroy(EMPTY_TEAMS))),
  );

  it.effect("returns an empty list for AFLM when upstream returns no teams", () =>
    // AFLM path filters by AFL_SENIOR_TEAMS allow-list and does NOT backfill,
    // so an empty upstream response yields an empty list. Locks in the
    // contrast with the AFLW backfill above.
    Effect.gen(function* () {
      const teams = yield* fetchTeams({ competition: "AFLM" });

      expect(teams).toHaveLength(0);
    }).pipe(Effect.provide(fixtureFitzroy(EMPTY_TEAMS))),
  );

  it.effect("returns AFLM + AFLW combined when no competition is specified", () =>
    // With empty upstream, AFLM contributes 0 and AFLW contributes the 4
    // backfill teams — exercises the dual-fetch branch in fetchTeams.
    Effect.gen(function* () {
      const teams = yield* fetchTeams();

      expect(teams).toHaveLength(4);
      const competitions = new Set(teams.map((t) => t.competition));
      expect(competitions.has("AFLW")).toBe(true);
    }).pipe(Effect.provide(fixtureFitzroy(EMPTY_TEAMS))),
  );
});
