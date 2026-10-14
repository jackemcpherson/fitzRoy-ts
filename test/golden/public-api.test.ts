/**
 * Golden characterisation tests for the public API (v7 migration safety net).
 *
 * Each case runs one exported library function against the committed
 * fixtures and snapshots the complete outcome: the sorted set of requested
 * URLs plus either the returned data or the failure's name, message, and
 * fields. The v7 Effect migration must keep these snapshots unchanged apart
 * from the result envelope, so data and error behaviour cannot drift.
 *
 * Each Effect runs against `FitzroyLive` with `FetchHttpClient.Fetch`
 * replaced by the fixture router, so no global `fetch` is stubbed.
 */
import { createHash } from "node:crypto";
import { Cause, Effect, Exit, type Layer, Predicate, type Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  fetchAwards,
  fetchLadder,
  fetchLineup,
  fetchMatchCoaches,
  fetchMatches,
  fetchPlayerDetails,
  fetchPlayerStats,
  fetchSeasons,
  fetchSquad,
  fetchTeamStats,
  fetchTeams,
  FitzroyLive,
  resolveDefaultSeasonForCompetition,
  type SourceError,
} from "../../src/index";
import { goldenFetch, requested, resetRequested } from "./fixture-fetch";

/** Reduce an error to its stable, comparable fields. */
function describeError(error: SourceError | Error) {
  const fields = Object.fromEntries(
    Object.entries(error).filter(([key]) => key !== "stack" && key !== "cause"),
  );

  return { name: error.name, message: error.message, fields };
}

/** Describe the squashed failure of a cause; non-`Error` defects become their string form. */
function describeCause(cause: Cause.Cause<SourceError>) {
  const squashed = Cause.squash(cause);

  return squashed instanceof Error ? describeError(squashed) : { thrown: String(squashed) };
}

/** Arrays longer than this are summarised by count, head, and digest. */
const MAX_INLINE_ITEMS = 25;

/**
 * Keep snapshots reviewable: long arrays become their length, first three
 * items, and a SHA-256 of the full JSON, so any change still fails.
 */
function summarise(value: Schema.Json): Schema.Json {
  if (Array.isArray(value)) {
    if (value.length <= MAX_INLINE_ITEMS) return value.map(summarise);

    return {
      count: value.length,
      head: value.slice(0, 3).map(summarise),
      sha256: createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    };
  }

  if (
    value === null ||
    Predicate.isString(value) ||
    Predicate.isNumber(value) ||
    Predicate.isBoolean(value)
  ) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, summarise(item)]));
}

/** The AFL API token request depends on cache state shared across cases. */
function isTokenRequest(url: string): boolean {
  return url.includes("WMCTok");
}

interface Outcome {
  readonly urls: readonly string[];
  readonly outcome: unknown;
}

/** Services `FitzroyLive` provides. */
type FitzroyServices = Layer.Success<typeof FitzroyLive>;

/** One public API call, as an Effect over the library services. */
type Call = () => Effect.Effect<unknown, SourceError, FitzroyServices>;

async function run(call: Call): Promise<Outcome> {
  const exit = await Effect.runPromiseExit(
    call().pipe(
      Effect.provide(FitzroyLive),
      Effect.provideService(FetchHttpClient.Fetch, goldenFetch),
    ),
  );

  const outcome = Exit.isSuccess(exit)
    ? { ok: summarise(JSON.parse(JSON.stringify(exit.value ?? null))) }
    : Cause.hasFails(exit.cause)
      ? { err: describeCause(exit.cause) }
      : { threw: describeCause(exit.cause) };

  return { urls: [...new Set(requested.filter((url) => !isTokenRequest(url)))].sort(), outcome };
}

const CASES: ReadonlyArray<readonly [string, Call]> = [
  [
    "fetchMatches afl-api 2025 r1",
    () => fetchMatches({ source: "afl-api", season: 2025, round: 1 }),
  ],
  [
    "fetchMatches afl-api 2024 r1",
    () => fetchMatches({ source: "afl-api", season: 2024, round: 1 }),
  ],
  ["fetchMatches footywire 2024", () => fetchMatches({ source: "footywire", season: 2024 })],
  ["fetchMatches afl-tables 2024", () => fetchMatches({ source: "afl-tables", season: 2024 })],
  [
    "fetchMatches squiggle 2024 r1",
    () => fetchMatches({ source: "squiggle", season: 2024, round: 1 }),
  ],
  ["fetchMatches fryzigg unsupported", () => fetchMatches({ source: "fryzigg", season: 2024 })],
  [
    "fetchMatches VFL 2019 out of range",
    () => fetchMatches({ source: "afl-api", season: 2019, competition: "VFL" }),
  ],
  [
    "fetchPlayerStats afl-api 2024 r1",
    () => fetchPlayerStats({ source: "afl-api", season: 2024, round: 1 }),
  ],
  [
    "fetchPlayerStats footywire 2024 r1",
    () => fetchPlayerStats({ source: "footywire", season: 2024, round: 1 }),
  ],
  [
    "fetchPlayerStats afl-tables 2024 r1",
    () => fetchPlayerStats({ source: "afl-tables", season: 2024, round: 1 }),
  ],
  [
    "fetchPlayerStats fryzigg 2024 r1",
    () => fetchPlayerStats({ source: "fryzigg", season: 2024, round: 1 }),
  ],
  [
    "fetchLadder afl-api 2024 r10",
    () => fetchLadder({ source: "afl-api", season: 2024, round: 10 }),
  ],
  [
    "fetchLadder squiggle 2024 r10",
    () => fetchLadder({ source: "squiggle", season: 2024, round: 10 }),
  ],
  [
    "fetchLadder afl-tables 2024 r10",
    () => fetchLadder({ source: "afl-tables", season: 2024, round: 10 }),
  ],
  ["fetchLineup afl-api 2024 r1", () => fetchLineup({ source: "afl-api", season: 2024, round: 1 })],
  ["fetchTeams AFLM", () => fetchTeams({ competition: "AFLM" })],
  ["fetchSquad Carlton 2024", () => fetchSquad({ team: "Carlton", season: 2024 })],
  ["fetchTeamStats footywire 2024", () => fetchTeamStats({ source: "footywire", season: 2024 })],
  [
    "fetchTeamStats footywire 2024 averages",
    () => fetchTeamStats({ source: "footywire", season: 2024, summaryType: "averages" }),
  ],
  ["fetchTeamStats afl-tables 2024", () => fetchTeamStats({ source: "afl-tables", season: 2024 })],
  ["fetchSeasons AFLM", () => fetchSeasons("AFLM")],
  ["fetchSeasons AFLW", () => fetchSeasons("AFLW")],
  ["resolveDefaultSeasonForCompetition AFLM", () => resolveDefaultSeasonForCompetition("AFLM")],
  ["fetchAwards brownlow 2024", () => fetchAwards({ award: "brownlow", season: 2024 })],
  ["fetchAwards coaches 2024 r1", () => fetchAwards({ award: "coaches", season: 2024, round: 1 })],
  ["fetchMatchCoaches 2024", () => fetchMatchCoaches({ season: 2024 })],
  [
    "fetchPlayerDetails afl-api Carlton 2024",
    () => fetchPlayerDetails({ source: "afl-api", team: "Carlton", season: 2024 }),
  ],
];

describe("public API golden outcomes", () => {
  beforeEach(() => {
    resetRequested();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-13T00:00:00Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  for (const [name, call] of CASES) {
    it(`keeps the ${name} outcome`, async () => {
      expect(await run(call)).toMatchSnapshot();
    });
  }
});
