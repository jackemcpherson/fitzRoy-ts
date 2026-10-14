/**
 * Scraper canary (TST-03) — hits ONE cheap live page/endpoint per data
 * source and asserts the parsers still return non-empty Results for the
 * previous season. Run weekly by `.github/workflows/scraper-canary.yml`
 * (and on demand via `vp run canary`).
 *
 * Notes:
 * - Each source service keeps the default 30-second timeout — no overrides here.
 * - Fryzigg is intentionally skipped: its only artefact is an ~11 MB RDS
 *   dump, which is too heavy for a weekly liveness probe.
 * - Exits non-zero when any check fails so the workflow can open (or
 *   comment on) a tracking issue.
 *
 * Row-count baseline (#improve-8):
 * - Each successful run records source row counts to `scripts/canary-baseline.json`.
 * - On subsequent runs, a check fails if `count < previousCount * 0.85`
 *   (i.e. more than a 15% drop). This catches HTML/parser drift that
 *   silently sheds rows without total failure (which the >0 check alone
 *   already covers).
 * - Why 85%: chosen as a compromise between catching real drift (a
 *   FootyWire layout shift dropping ~30% of matches) and tolerating
 *   benign upstream variability (rounds in progress, late corrections).
 * - First run for a new source: logs "first run" and records the count
 *   without failing.
 * - A failed run never replaces the last known-good baseline artifact.
 */

import { readFile, writeFile } from "node:fs/promises";
import { Effect, Result, Schema } from "effect";
import { SourcesLive } from "../src/layers";
import { AflApi } from "../src/sources/afl-api";
import { AflTables } from "../src/sources/afl-tables";
import { FootyWire } from "../src/sources/footywire";
import { Squiggle } from "../src/sources/squiggle";
import { type Baseline, evaluateCount, promoteBaseline, validateBaseline } from "./canary-baseline";

/** Previous season — guaranteed to have complete published data. */
const season = new Date().getUTCFullYear() - 1;

/** Drift threshold — fail if the new count drops below this fraction of the previous count. */
const DRIFT_THRESHOLD = 0.85;

/** Path to the persisted baseline counts (relative to repo root, where the canary is run). */
const BASELINE_PATH = "scripts/canary-baseline.json";

/** A canary probe found the source alive but empty. */
class EmptyResultError extends Schema.TaggedError<EmptyResultError>()("EmptyResultError", {
  message: Schema.String,
}) {}

/** One probe's summary line and the row count used for baseline comparison. */
interface Observation {
  readonly summary: string;
  readonly count: number;
}

type SourceServices = AflApi | AflTables | FootyWire | Squiggle;

interface CanaryCheck {
  readonly name: string;
  readonly run: Effect.Effect<Observation, { readonly message: string }, SourceServices>;
}

/** Fail when a probe parsed nothing. */
function requireRows(count: number, what: string): Effect.Effect<void, EmptyResultError> {
  return count === 0
    ? Effect.fail(new EmptyResultError({ message: `parsed 0 ${what}` }))
    : Effect.void;
}

const checks: readonly CanaryCheck[] = [
  {
    // Public no-auth endpoint exercising the CompseasonListSchema parse.
    name: "afl-api",
    run: AflApi.use((aflApi) => aflApi.resolveCompSeason("AFLM", season)).pipe(
      // resolveCompSeason returns a single id; count is 1 when it resolves.
      Effect.map((id) => ({ summary: `resolved AFLM ${season} to compseason id ${id}`, count: 1 })),
    ),
  },
  {
    name: "afl-tables",
    run: Effect.gen(function* () {
      const matches = yield* AflTables.use((aflTables) => aflTables.fetchSeasonResults(season));

      yield* requireRows(matches.length, `matches for ${season}`);

      return { summary: `parsed ${matches.length} matches for ${season}`, count: matches.length };
    }),
  },
  {
    name: "footywire",
    run: Effect.gen(function* () {
      const matches = yield* FootyWire.use((footyWire) => footyWire.fetchSeasonResults(season));

      yield* requireRows(matches.length, `matches for ${season}`);

      return { summary: `parsed ${matches.length} matches for ${season}`, count: matches.length };
    }),
  },
  {
    name: "squiggle",
    run: Effect.gen(function* () {
      const { games } = yield* Squiggle.use((squiggle) => squiggle.fetchGames(season, 1));

      yield* requireRows(games.length, `games for ${season} round 1`);

      return {
        summary: `parsed ${games.length} games for ${season} round 1`,
        count: games.length,
      };
    }),
  },
];

/** Read the last known-good baseline; a missing or invalid file is empty. */
const readBaseline: Effect.Effect<Baseline> = Effect.tryPromise({
  try: () => readFile(BASELINE_PATH, "utf8"),
  catch: (cause) => cause,
}).pipe(
  Effect.flatMap((raw) =>
    Effect.try({ try: () => JSON.parse(raw), catch: (cause) => cause }).pipe(
      Effect.map((parsed) => {
        const baseline = validateBaseline(parsed);

        if (baseline === undefined) {
          console.warn(`warn: ${BASELINE_PATH} has an invalid shape; treating as empty`);

          return {};
        }

        return baseline;
      }),
    ),
  ),
  Effect.catch((cause) =>
    Effect.sync(() => {
      const isMissing = cause instanceof Error && "code" in cause && cause.code === "ENOENT";

      if (!isMissing) {
        const message = cause instanceof Error ? cause.message : String(cause);

        console.warn(`warn: failed to read ${BASELINE_PATH}: ${message}`);
      }

      return {};
    }),
  ),
);

/** Write the baseline with a stable key order for deterministic diffs. */
function writeBaseline(baseline: Baseline): Effect.Effect<void, Error> {
  const sorted: Baseline = {};

  for (const key of Object.keys(baseline).sort()) {
    const value = baseline[key];

    if (value !== undefined) sorted[key] = value;
  }

  return Effect.tryPromise({
    try: () => writeFile(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8"),
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  });
}

const program = Effect.gen(function* () {
  const previousBaseline = yield* readBaseline;
  const observedCounts: Baseline = {};
  let hasFailure = false;

  for (const check of checks) {
    const outcome = yield* Effect.result(check.run);

    if (Result.isFailure(outcome)) {
      hasFailure = true;
      console.error(`FAIL ${check.name}: ${outcome.failure.message}`);
      continue;
    }

    const { summary, count } = outcome.success;
    const previous = previousBaseline[check.name];
    const evaluation = evaluateCount(count, previous, DRIFT_THRESHOLD);

    switch (evaluation.status) {
      case "first-run":
        console.log(`ok   ${check.name}: ${summary} (first run, recording ${count})`);
        break;
      case "accepted":
        console.log(`ok   ${check.name}: ${summary} (previous=${evaluation.previous})`);
        break;
      case "drift":
        hasFailure = true;
        console.error(
          `FAIL ${check.name}: row-count drift — previous=${evaluation.previous}, new=${count} (below ${DRIFT_THRESHOLD * 100}% floor of ${evaluation.floor.toFixed(1)})`,
        );
    }

    observedCounts[check.name] = count;
  }

  if (!hasFailure) {
    const written = yield* Effect.result(
      writeBaseline(promoteBaseline(previousBaseline, observedCounts, true)),
    );

    if (Result.isFailure(written)) {
      hasFailure = true;
      console.error(`FAIL baseline: failed to write ${BASELINE_PATH}: ${written.failure.message}`);
    }
  }

  if (hasFailure) process.exitCode = 1;
});

await Effect.runPromise(program.pipe(Effect.provide(SourcesLive)));
