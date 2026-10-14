import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { fetchAwards } from "../../src/api/awards";
import { ScrapeError } from "../../src/lib/errors";
import type { MatchSource, PlayerStatsSource } from "../../src/sources/adapters/capabilities";
import { CapabilityRegistry } from "../../src/sources/adapters/registry";
import { AflCoaches } from "../../src/sources/afl-coaches";
import type {
  CoachesVote,
  CoachesVotesResult,
  Match,
  MatchQuery,
  PlayerStatsQuery,
  SeasonPlayerStats,
} from "../../src/types";
import { matchFixture as match, playerStatsFixture as playerStats } from "../support/domain";
import { type RequestLog, requestLog } from "../support/http";
import { FULL_COVERAGE, fixtureFitzroy, stubRegistry, unexpectedCall } from "../support/services";

function brownlowHtml(): string {
  const rows = [
    ["Player", "Team", "V", "3V", "2V", "1V", "Played", "Polled", "V/G"],
    ["Blue Leader", "Carlton", "30", "10", "0", "0", "23", "10", "1.30"],
    ["Magpie Runner", "Collingwood", "20", "6", "1", "0", "23", "7", "0.87"],
    ["Filler One", "Richmond", "0", "0", "0", "0", "1", "0", "0.00"],
    ["Filler Two", "Geelong", "0", "0", "0", "0", "1", "0", "0.00"],
  ];

  return `<table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</table>`;
}

function allAustralianHtml(): string {
  return '<table><tr><td>FB</td><td><a>Blue Defender</a><span class="playerflag">Carlton</span></td></tr></table>';
}

function risingStarHtml(): string {
  const header = [
    "Rd",
    "Name",
    "Team",
    "Opponent",
    "K",
    "H",
    "D",
    "M",
    "G",
    "B",
    "T",
    "X",
    "X",
    "X",
    "X",
  ];

  const player = [
    "1",
    "Blue Youngster",
    "Carlton",
    "Richmond",
    "10",
    "8",
    "18",
    "4",
    "2",
    "1",
    "3",
    "",
    "",
    "",
    "",
  ];

  const filler = Array.from({ length: 3 }, (_, i) => [
    String(i + 2),
    `Player ${i}`,
    "Richmond",
    "Carlton",
    "1",
    "1",
    "2",
    "1",
    "0",
    "0",
    "1",
    "",
    "",
    "",
    "",
  ]);

  return `<table>${[header, player, ...filler].map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</table>`;
}

/** The library environment with every FootyWire request answered by `body`. */
function footyWireServing(body: string, log: RequestLog, status = 200) {
  return fixtureFitzroy([[/./, { body, status }]], log);
}

/** An AFL Coaches service answering with fixed votes. */
function coachesServing(service: {
  readonly scrapeRoundVotes?: () => Effect.Effect<CoachesVote[], ScrapeError>;
  readonly fetchSeasonVotes?: () => Effect.Effect<CoachesVotesResult, ScrapeError>;
}) {
  return Layer.succeed(AflCoaches, {
    scrapeRoundVotes: service.scrapeRoundVotes ?? unexpectedCall("scrapeRoundVotes"),
    fetchSeasonVotes: service.fetchSeasonVotes ?? unexpectedCall("fetchSeasonVotes"),
  });
}

/** The queries the Coleman adapters received. */
interface ColemanCalls {
  readonly matches: MatchQuery[];
  readonly stats: PlayerStatsQuery[];
}

/**
 * A registry with AFL API match and player-stats adapters answering with
 * fixed data and recording the queries they receive.
 */
function colemanRegistry(
  matches: Effect.Effect<Match[], ScrapeError>,
  stats: Effect.Effect<SeasonPlayerStats, ScrapeError>,
  calls?: ColemanCalls,
) {
  const matchSource: MatchSource = {
    id: "afl-api",
    coverage: FULL_COVERAGE,
    fetchMatches: (query) => {
      calls?.matches.push(query);

      return matches;
    },
  };

  const statsSource: PlayerStatsSource = {
    id: "afl-api",
    coverage: FULL_COVERAGE,
    fetchPlayerStats: (query) => {
      calls?.stats.push(query);

      return stats;
    },
  };

  return stubRegistry({
    match: new CapabilityRegistry("afl-api", [matchSource]),
    playerStats: new CapabilityRegistry("afl-api", [statsSource]),
  });
}

describe("fetchAwards FootyWire routing", () => {
  it.effect.each([
    ["brownlow", "brownlow_medal", brownlowHtml(), "Blue Leader"],
    ["all-australian", "all_australian_selection", allAustralianHtml(), "Blue Defender"],
    ["rising-star", "rising_star_nominations", risingStarHtml(), "Blue Youngster"],
  ] as const)("routes and parses %s", ([award, path, html, player]) => {
    const log = requestLog();

    return Effect.gen(function* () {
      const result = yield* fetchAwards({ award, season: 2025 });

      expect(result.awards.some((entry) => "player" in entry && entry.player === player)).toBe(
        true,
      );
      expect(result.failedRounds).toEqual([]);
      expect(log.urls).toHaveLength(1);
      expect(log.urls[0]).toContain(`${path}?year=2025`);
    }).pipe(Effect.provide(footyWireServing(html, log)));
  });

  it.effect.each(["AFLW", "VFL", "VFLW"] as const)(
    "rejects FootyWire awards for %s without fetching",
    (competition) => {
      const log = requestLog();

      return Effect.gen(function* () {
        yield* Effect.flip(fetchAwards({ award: "brownlow", season: 2025, competition }));

        expect(log.urls).toEqual([]);
      }).pipe(Effect.provide(footyWireServing(brownlowHtml(), log)));
    },
  );

  it.effect("propagates a non-OK upstream response", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(fetchAwards({ award: "brownlow", season: 2025 }));

      expect(error.message).toContain("503");
    }).pipe(Effect.provide(footyWireServing("upstream unavailable", requestLog(), 503))),
  );

  it.effect("fails when parsing yields no rows", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(fetchAwards({ award: "all-australian", season: 2025 }));

      expect(error.message).toContain("No All-Australian data");
    }).pipe(
      Effect.provide(footyWireServing("<html><body>No award table</body></html>", requestLog())),
    ),
  );

  it.effect("applies team filtering before limit", () =>
    Effect.gen(function* () {
      const result = yield* fetchAwards({
        award: "brownlow",
        season: 2025,
        team: "Blues",
        limit: 1,
      });

      expect(result.awards).toHaveLength(1);
      expect(result.awards[0]).toMatchObject({ player: "Blue Leader", team: "Carlton" });
    }).pipe(Effect.provide(footyWireServing(brownlowHtml(), requestLog()))),
  );
});

describe("fetchAwards coaches filtering", () => {
  it.effect("matches either home or away team and applies the limit", () =>
    Effect.gen(function* () {
      const result = yield* fetchAwards({
        award: "coaches",
        season: 2025,
        team: "Blues",
        limit: 1,
      });

      expect(result.awards).toHaveLength(1);
      expect(result.awards[0]).toMatchObject({ player: "First Blue" });
      expect(result.failedRounds).toEqual([4]);
    }).pipe(
      Effect.provide(
        coachesServing({
          fetchSeasonVotes: () =>
            Effect.succeed({
              votes: [
                {
                  type: "coaches",
                  season: 2025,
                  competition: "AFLM",
                  source: "afl-coaches",
                  round: 1,
                  homeTeam: "Carlton",
                  awayTeam: "Richmond",
                  player: "First Blue",
                  votes: 10,
                },
                {
                  type: "coaches",
                  season: 2025,
                  competition: "AFLM",
                  source: "afl-coaches",
                  round: 2,
                  homeTeam: "Collingwood",
                  awayTeam: "Carlton",
                  player: "Second Blue",
                  votes: 9,
                },
                {
                  type: "coaches",
                  season: 2025,
                  competition: "AFLM",
                  source: "afl-coaches",
                  round: 3,
                  homeTeam: "Richmond",
                  awayTeam: "Geelong",
                  player: "Tiger",
                  votes: 8,
                },
              ],
              failedRounds: [4],
            }),
        }),
      ),
      Effect.provide(fixtureFitzroy()),
    ),
  );

  it.effect("uses an empty failure list for a successful single-round request", () =>
    Effect.gen(function* () {
      const result = yield* fetchAwards({ award: "coaches", season: 2025, round: 2 });

      expect(result.awards).toHaveLength(1);
      expect(result.failedRounds).toEqual([]);
    }).pipe(
      Effect.provide(
        coachesServing({
          scrapeRoundVotes: () =>
            Effect.succeed([
              {
                type: "coaches",
                season: 2025,
                competition: "AFLM",
                source: "afl-coaches",
                round: 2,
                homeTeam: "Carlton",
                awayTeam: "Richmond",
                player: "Patrick Cripps",
                votes: 10,
              },
            ]),
        }),
      ),
      Effect.provide(fixtureFitzroy()),
    ),
  );
});

describe("fetchAwards Coleman orchestration", () => {
  it.effect("excludes finals stats by matching home-and-away match IDs", () => {
    const calls: ColemanCalls = { matches: [], stats: [] };

    return Effect.gen(function* () {
      const result = yield* fetchAwards({ award: "coleman", season: 2025 });

      expect(result.awards.map((entry) => "player" in entry && entry.player)).toEqual([
        "Home Leader",
      ]);
      expect(result.failedRounds).toEqual([]);
      expect(calls.matches).toEqual([
        { source: "afl-api", season: 2025, competition: "AFLM", status: "Complete" },
      ]);
      expect(calls.stats).toEqual([{ source: "afl-api", season: 2025, competition: "AFLM" }]);
    }).pipe(
      Effect.provide(
        colemanRegistry(
          Effect.succeed([match("H1", "HomeAndAway"), match("F1", "Finals")]),
          Effect.succeed({
            stats: [
              playerStats("H1", "home-leader", "Home Leader", 5),
              playerStats("F1", "finals-leader", "Finals Leader", 20),
            ],
            failedMatchIds: [],
          }),
          calls,
        ),
      ),
      Effect.provide(fixtureFitzroy()),
    );
  });

  it.effect("filters the full Coleman field by team before applying the limit", () =>
    Effect.gen(function* () {
      const result = yield* fetchAwards({
        award: "coleman",
        season: 2025,
        team: "Blues",
        limit: 1,
      });

      expect(result.awards).toHaveLength(1);
      expect(result.awards[0]).toMatchObject({ player: "First Blue", team: "Carlton" });
    }).pipe(
      Effect.provide(
        colemanRegistry(
          Effect.succeed([match("H1", "HomeAndAway")]),
          Effect.succeed({
            stats: [
              playerStats("H1", "leader", "League Leader", 8, "Richmond"),
              playerStats("H1", "blue-one", "First Blue", 6, "Carlton"),
              playerStats("H1", "blue-two", "Second Blue", 5, "Carlton"),
            ],
            failedMatchIds: [],
          }),
        ),
      ),
      Effect.provide(fixtureFitzroy()),
    ),
  );

  it.effect.each([
    ["matches", new ScrapeError({ message: "matches unavailable", source: "afl-api" })],
    ["stats", new ScrapeError({ message: "stats unavailable", source: "afl-api" })],
  ] as const)("propagates %s upstream failure", ([failedSource, failure]) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(fetchAwards({ award: "coleman", season: 2025 }));

      expect(error).toBe(failure);
    }).pipe(
      Effect.provide(
        colemanRegistry(
          failedSource === "matches" ? Effect.fail(failure) : Effect.succeed([]),
          failedSource === "stats"
            ? Effect.fail(failure)
            : Effect.succeed({ stats: [], failedMatchIds: [] }),
        ),
      ),
      Effect.provide(fixtureFitzroy()),
    ),
  );
});
