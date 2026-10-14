import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { fetchTeamStats } from "../../src/api/team-stats";
import { aflTablesTeamStatsSource } from "../../src/sources/adapters/afl-tables";
import { footyWireTeamStatsSource } from "../../src/sources/adapters/footywire";
import { CapabilityRegistry } from "../../src/sources/adapters/registry";
import { AflTables, parseAflTablesTeamStats } from "../../src/sources/afl-tables";
import { FootyWire, FootyWireLive, parseFootyWireTeamStats } from "../../src/sources/footywire";
import { ScrapeError } from "../../src/lib/errors";
import type { Match, TeamStatsEntry } from "../../src/types";
import { matchFixture } from "../support/domain";
import { fixtureHttp, fixtureText } from "../support/http";
import { fixtureFitzroy, stubRegistry, unexpectedCall } from "../support/services";

const fwHtml = fixtureText("footywire-team-stats.html");

const fwOppHtml = fixtureText("footywire-team-stats-opp.html");

const atHtml = fixtureText("afl-tables-team-stats.html");

describe("parseFootyWireTeamStats", () => {
  it("returns intermediate per-direction entries with canonical metrics", () => {
    const entries = parseFootyWireTeamStats(fwHtml, 2024);

    expect(entries).toHaveLength(3);
    const teams = entries.map((e) => e.team);
    expect(teams).toContain("Carlton");
    expect(teams).toContain("Geelong Cats");
    expect(teams).toContain("Sydney Swans");

    const carlton = entries.find((e) => e.team === "Carlton");
    expect(carlton).toBeDefined();

    if (!carlton) return;

    expect(carlton.gamesPlayed).toBe(22);
    expect(carlton.metrics.kicks).toBe(3200);
    expect(carlton.metrics.handballs).toBe(2100);
    expect(carlton.metrics.disposals).toBe(5300);
    // Behinds canonicalisation also fixes the latent CLI bug where the
    // `B` table column rendered empty because FootyWire emitted `BH`. (#98)
    expect(carlton.metrics.behinds).toEqual(expect.any(Number));
    // FootyWire-only metrics populated; AFL Tables-only stay null
    expect(carlton.metrics.brownlowVotes).toBeNull();
  });

  it("returns empty array for empty HTML", () => {
    expect(parseFootyWireTeamStats("<html></html>", 2024)).toEqual([]);
  });
});

describe("parseAflTablesTeamStats", () => {
  it("parses canonical for/against TeamMetricSet from fixture", () => {
    const entries = parseAflTablesTeamStats(atHtml, 2024);

    expect(entries).toHaveLength(2);
    const teams = entries.map((e) => e.team);
    expect(teams).toContain("Carlton");
    expect(teams).toContain("Geelong Cats");

    const carlton = entries.find((e) => e.team === "Carlton");
    expect(carlton).toBeDefined();

    if (!carlton) return;

    expect(carlton.competition).toBe("AFLM");
    expect(carlton.gamesPlayed).toBeNull();
    expect(carlton.for.kicks).toBe(3200);
    expect(carlton.against.kicks).toBe(3000);
    expect(carlton.source).toBe("afl-tables");
    // AFL Tables-only metric populated; FootyWire-only stay null
    expect(carlton.for.fantasyPoints).toBeNull();
  });

  it("returns empty array for empty HTML", () => {
    expect(parseAflTablesTeamStats("<html></html>", 2024)).toEqual([]);
  });
});

describe("aflTablesTeamStatsSource games-played enrichment", () => {
  const missingGames = parseAflTablesTeamStats(atHtml, 2024).map((entry) => ({
    ...entry,
    gamesPlayed: null,
  }));

  /** An AFL Tables service serving fixed team stats and season results. */
  function aflTablesServing(
    stats: readonly TeamStatsEntry[],
    results: Effect.Effect<Match[], ScrapeError>,
    resultCalls: number[] = [],
  ) {
    return Layer.succeed(AflTables, {
      fetchSeasonResults: (year) => {
        resultCalls.push(year);

        return results;
      },
      fetchSeasonPlayerStats: unexpectedCall("fetchSeasonPlayerStats"),
      fetchTeamStats: () => Effect.succeed([...stats]),
      fetchPlayerList: unexpectedCall("fetchPlayerList"),
    });
  }

  const resultsUnavailable = Effect.fail(
    new ScrapeError({ message: "results unavailable", source: "afl-tables" }),
  );

  it.effect("enriches missing denominators from successful match results", () =>
    Effect.gen(function* () {
      const source = yield* aflTablesTeamStatsSource;

      const entries = yield* source.fetchTeamStats({ source: "afl-tables", season: 2024 });

      expect(entries.find((entry) => entry.team === "Carlton")?.gamesPlayed).toBe(2);
      expect(entries.find((entry) => entry.team === "Geelong Cats")?.gamesPlayed).toBe(1);
    }).pipe(
      Effect.provide(
        aflTablesServing(
          missingGames,
          Effect.succeed([
            { ...matchFixture("M1", "HomeAndAway"), homeTeam: "Carlton", awayTeam: "Geelong Cats" },
            { ...matchFixture("M2", "HomeAndAway"), homeTeam: "Carlton", awayTeam: "Richmond" },
          ]),
        ),
      ),
    ),
  );

  it.effect("returns totals with null denominators when enrichment fails", () =>
    Effect.gen(function* () {
      const source = yield* aflTablesTeamStatsSource;

      const entries = yield* source.fetchTeamStats({
        source: "afl-tables",
        season: 2024,
        summaryType: "totals",
      });

      expect(entries.every((entry) => entry.gamesPlayed === null)).toBe(true);
    }).pipe(Effect.provide(aflTablesServing(missingGames, resultsUnavailable))),
  );

  it.effect("rejects averages when any denominator remains missing", () =>
    Effect.gen(function* () {
      const source = yield* aflTablesTeamStatsSource;

      const error = yield* Effect.flip(
        source.fetchTeamStats({
          source: "afl-tables",
          season: 2024,
          summaryType: "averages",
        }),
      );

      expect(error.message).toContain("games played");
    }).pipe(Effect.provide(aflTablesServing(missingGames, resultsUnavailable))),
  );

  it.effect("rejects averages when a denominator is non-positive", () => {
    const zeroGames = missingGames.map((entry, index) => ({
      ...entry,
      gamesPlayed: index === 0 ? 0 : 1,
    }));

    const resultCalls: number[] = [];

    return Effect.gen(function* () {
      const source = yield* aflTablesTeamStatsSource;

      yield* Effect.flip(
        source.fetchTeamStats({
          source: "afl-tables",
          season: 2024,
          summaryType: "averages",
        }),
      );

      expect(resultCalls).toEqual([]);
    }).pipe(
      Effect.provide(aflTablesServing(zeroGames, Effect.die(new Error("unexpected")), resultCalls)),
    );
  });
});

describe("FootyWire.fetchTeamStats", () => {
  it.effect("fetches and merges team and opposition stats into canonical for/against", () =>
    Effect.gen(function* () {
      const footyWire = yield* FootyWire;

      const entries = yield* footyWire.fetchTeamStats(2024);

      expect(entries).toHaveLength(3);
      const carlton = entries.find((e) => e.team === "Carlton");
      expect(carlton?.competition).toBe("AFLM");
      expect(carlton?.for.kicks).toBe(3200);
      expect(carlton?.against.kicks).toBe(3000);
      expect(carlton?.against.handballs).toBe(2000);
    }).pipe(
      Effect.provide(
        FootyWireLive.pipe(
          Layer.provide(
            fixtureHttp([
              ["type=TT", { body: fwHtml }],
              ["type=OT", { body: fwOppHtml }],
            ]),
          ),
        ),
      ),
    ),
  );

  it.effect("fails on non-OK response", () =>
    Effect.gen(function* () {
      const footyWire = yield* FootyWire;

      const error = yield* Effect.flip(footyWire.fetchTeamStats(2024));

      expect(error).toBeInstanceOf(ScrapeError);
    }).pipe(
      Effect.provide(FootyWireLive.pipe(Layer.provide(fixtureHttp([[/./, { status: 403 }]])))),
    ),
  );
});

/**
 * A registry whose only team-stats adapter is the real FootyWire adapter
 * (with its real coverage) over a FootyWire service that records each
 * `fetchTeamStats` call and returns `entries`.
 */
function footyWireTeamStatsRegistry(entries: readonly TeamStatsEntry[], calls: number[]) {
  const footyWire = Layer.succeed(FootyWire, {
    fetchPage: unexpectedCall("fetchPage"),
    fetchSeasonResults: unexpectedCall("fetchSeasonResults"),
    fetchMatchPlayerStats: unexpectedCall("fetchMatchPlayerStats"),
    fetchSeasonMatchIds: unexpectedCall("fetchSeasonMatchIds"),
    fetchPlayerList: unexpectedCall("fetchPlayerList"),
    fetchSeasonFixture: unexpectedCall("fetchSeasonFixture"),
    fetchTeamStats: (year) => {
      calls.push(year);

      return Effect.succeed([...entries]);
    },
  });

  return Layer.unwrap(
    Effect.map(footyWireTeamStatsSource, (adapter) =>
      stubRegistry({ teamStats: new CapabilityRegistry("afl-tables", [adapter]) }),
    ),
  ).pipe(Layer.provide(footyWire));
}

describe("fetchTeamStats public API", () => {
  it.effect.each(["afl-api", "squiggle"] as const)("fails for unsupported %s source", (source) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(fetchTeamStats({ source, season: 2024 }));

      expect(error.message).toContain(`${source} does not provide team stats`);
    }).pipe(Effect.provide(fixtureFitzroy())),
  );

  it.effect("rejects an unsupported competition before adapter network access", () => {
    const calls: number[] = [];

    return Effect.gen(function* () {
      yield* Effect.flip(
        fetchTeamStats({
          source: "footywire",
          season: 2024,
          competition: "AFLW",
        }),
      );

      expect(calls).toEqual([]);
    }).pipe(Effect.provide(footyWireTeamStatsRegistry([], calls)));
  });

  it.effect("defaults competition coverage to AFLM", () => {
    const calls: number[] = [];

    return Effect.gen(function* () {
      yield* fetchTeamStats({ source: "footywire", season: 2024 });

      expect(calls).toEqual([2024]);
    }).pipe(Effect.provide(footyWireTeamStatsRegistry([], calls)));
  });

  it.effect("rejects averages with a missing denominator from any source", () => {
    const [carlton] = parseAflTablesTeamStats(atHtml, 2024).filter(
      (entry) => entry.team === "Carlton",
    );

    const entries = carlton ? [{ ...carlton, gamesPlayed: null }] : [];

    return Effect.gen(function* () {
      expect(entries).toHaveLength(1);

      const error = yield* Effect.flip(
        fetchTeamStats({
          source: "footywire",
          season: 2024,
          summaryType: "averages",
        }),
      );

      expect(error.message).toContain("games played");
    }).pipe(Effect.provide(footyWireTeamStatsRegistry(entries, [])));
  });
});
