/**
 * Golden characterisation tests for the public API (v7 migration safety net).
 *
 * Each case runs one exported library function against the committed
 * fixtures and snapshots the complete outcome: every requested URL (sorted,
 * duplicates kept so request counts show) plus either the returned data or
 * the failure's name, message, and fields. Serialisation marks `undefined`
 * values and `Date` instances so neither is lost in the JSON round trip. The v7 Effect migration must keep these snapshots unchanged apart
 * from the result envelope, so data and error behaviour cannot drift.
 */
import { createHash } from "node:crypto";
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
  resolveDefaultSeasonForCompetition,
} from "../../src/index";
import { FRYZIGG_SNAPSHOTS } from "../../src/sources/fryzigg-snapshots";
import { goldenFetch, requested, resetRequested } from "./fixture-fetch";

/** SHA-256 of `test/fixtures/fryzigg-sample.rds`, the golden Fryzigg snapshot. */
const FRYZIGG_FIXTURE_SHA256 = "e41773328a6cd1e926f22a1ed0f54cc18e4d0d21743172bdbde3b2f87843cd58";

/**
 * Run a call with the AFLM Fryzigg checksum pointed at the fixture, so the
 * golden case exercises download, parsing, and the transform instead of
 * stopping at the checksum check.
 */
async function withFryziggFixture<T>(call: () => Promise<T>): Promise<T> {
  const reviewed = FRYZIGG_SNAPSHOTS.AFLM.sha256;
  Object.assign(FRYZIGG_SNAPSHOTS.AFLM, { sha256: FRYZIGG_FIXTURE_SHA256 });

  try {
    return await call();
  } finally {
    Object.assign(FRYZIGG_SNAPSHOTS.AFLM, { sha256: reviewed });
  }
}

/** JSON round trip that keeps `undefined` values and `Date` instances visible. */
function toJson(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value ?? null, function (this: Record<string, unknown>, key, item: unknown) {
      const original = this[key];

      if (original instanceof Date) return { $date: original.toISOString() };

      return item === undefined ? "$undefined" : item;
    }),
  );
}

/** Reduce an error to its stable, comparable fields. */
function describeError(error: unknown): unknown {
  if (!(error instanceof Error)) return { thrown: String(error) };
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(error)) {
    if (key !== "stack" && key !== "cause") fields[key] = value;
  }

  return { name: error.name, message: error.message, fields };
}

/** Arrays longer than this are summarised by count, head, and digest. */
const MAX_INLINE_ITEMS = 25;

/**
 * Keep snapshots reviewable: long arrays become their length, first three
 * items, and a SHA-256 of the full JSON, so any change still fails.
 */
function summarise(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length <= MAX_INLINE_ITEMS) return value.map(summarise);

    return {
      count: value.length,
      head: value.slice(0, 3).map(summarise),
      sha256: createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    };
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, summarise(item)]));
  }

  return value;
}

/** The AFL API token request depends on cache state shared across cases. */
function isTokenRequest(url: string): boolean {
  return url.includes("WMCTok");
}

interface Outcome {
  readonly urls: readonly string[];
  readonly outcome: unknown;
}

async function run(call: () => Promise<unknown>): Promise<Outcome> {
  let outcome: unknown;

  try {
    const result = await call();

    if (result !== null && typeof result === "object" && "success" in result) {
      const settled = result as { success: boolean; data?: unknown; error?: unknown };
      outcome = settled.success
        ? { ok: summarise(toJson(settled.data)) }
        : { err: describeError(settled.error) };
    } else {
      outcome = { value: summarise(toJson(result)) };
    }
  } catch (error) {
    outcome = { threw: describeError(error) };
  }

  return { urls: requested.filter((url) => !isTokenRequest(url)).sort(), outcome };
}

const CASES: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
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
    () => withFryziggFixture(() => fetchPlayerStats({ source: "fryzigg", season: 2024, round: 1 })),
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
    vi.stubGlobal("fetch", goldenFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  for (const [name, call] of CASES) {
    it(`keeps the ${name} outcome`, async () => {
      expect(await run(call)).toMatchSnapshot();
    });
  }
});
