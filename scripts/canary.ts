/**
 * Scraper canary (TST-03) — hits ONE cheap live page/endpoint per data
 * source and asserts the parsers still return non-empty Results for the
 * previous season. Run weekly by `.github/workflows/scraper-canary.yml`
 * (and on demand via `bun scripts/canary.ts`).
 *
 * Notes:
 * - Each client keeps its default 30-second timeout — no overrides here.
 * - Fryzigg is intentionally skipped: its only artefact is an ~11 MB RDS
 *   dump, which is too heavy for a weekly liveness probe.
 * - Exits non-zero when any check fails so the workflow can open (or
 *   comment on) a tracking issue.
 *
 * Row-count baseline (#improve-8):
 * - Each source records a row count to `scripts/canary-baseline.json`.
 * - On subsequent runs, a check fails if `count < previousCount * 0.85`
 *   (i.e. more than a 15% drop). This catches HTML/parser drift that
 *   silently sheds rows without total failure (which the >0 check alone
 *   already covers).
 * - Why 85%: chosen as a compromise between catching real drift (a
 *   FootyWire layout shift dropping ~30% of matches) and tolerating
 *   benign upstream variability (rounds in progress, late corrections).
 * - First run for a new source: logs "first run" and records the count
 *   without failing.
 * - Manually bumping the baseline: when the team accepts a new lower
 *   count (e.g. a season's worth of finals dropped from the previous
 *   season probe), either edit `scripts/canary-baseline.json` by hand
 *   to the new floor, or let the next successful CI run overwrite it
 *   (the canary always writes the latest counts on success).
 */

import { readFile, writeFile } from "node:fs/promises";
import { AflApiClient } from "../src/sources/afl-api";
import { AflTablesClient } from "../src/sources/afl-tables";
import { FootyWireClient } from "../src/sources/footywire";
import { SquiggleClient } from "../src/sources/squiggle";

/** Previous season — guaranteed to have complete published data. */
const season = new Date().getUTCFullYear() - 1;

/** Drift threshold — fail if the new count drops below this fraction of the previous count. */
const DRIFT_THRESHOLD = 0.85;

/** Path to the persisted baseline counts (relative to repo root, where bun is invoked). */
const BASELINE_PATH = "scripts/canary-baseline.json";

interface CanaryCheck {
  readonly name: string;
  /**
   * Runs the probe; resolves to `{ summary, count }` or throws on failure.
   * The `count` is the row/entity count used for baseline comparison.
   */
  readonly run: () => Promise<{ summary: string; count: number }>;
}

const checks: readonly CanaryCheck[] = [
  {
    // Public no-auth endpoint exercising the CompseasonListSchema parse.
    name: "afl-api",
    run: async () => {
      const result = await new AflApiClient().resolveCompSeason("AFLM", season);
      if (!result.success) throw result.error;
      // resolveCompSeason returns a single id; count is 1 when it resolves.
      return { summary: `resolved AFLM ${season} to compseason id ${result.data}`, count: 1 };
    },
  },
  {
    name: "afl-tables",
    run: async () => {
      const result = await new AflTablesClient().fetchSeasonResults(season);
      if (!result.success) throw result.error;
      if (result.data.length === 0) throw new Error(`parsed 0 matches for ${season}`);
      return {
        summary: `parsed ${result.data.length} matches for ${season}`,
        count: result.data.length,
      };
    },
  },
  {
    name: "footywire",
    run: async () => {
      const result = await new FootyWireClient().fetchSeasonResults(season);
      if (!result.success) throw result.error;
      if (result.data.length === 0) throw new Error(`parsed 0 matches for ${season}`);
      return {
        summary: `parsed ${result.data.length} matches for ${season}`,
        count: result.data.length,
      };
    },
  },
  {
    name: "squiggle",
    run: async () => {
      const result = await new SquiggleClient().fetchGames(season, 1);
      if (!result.success) throw result.error;
      if (result.data.games.length === 0) throw new Error(`parsed 0 games for ${season} round 1`);
      return {
        summary: `parsed ${result.data.games.length} games for ${season} round 1`,
        count: result.data.games.length,
      };
    },
  },
];

/** Persisted shape of `scripts/canary-baseline.json`: source name -> last recorded count. */
type Baseline = Record<string, number>;

async function readBaseline(): Promise<Baseline> {
  try {
    const raw = await readFile(BASELINE_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(`warn: ${BASELINE_PATH} is not a JSON object; treating as empty`);
      return {};
    }
    const baseline: Baseline = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        baseline[key] = value;
      }
    }
    return baseline;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return {};
    }
    console.warn(
      `warn: failed to read ${BASELINE_PATH}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {};
  }
}

async function writeBaseline(baseline: Baseline): Promise<void> {
  // Stable key order for deterministic diffs.
  const sorted: Baseline = {};
  for (const key of Object.keys(baseline).sort()) {
    const value = baseline[key];
    if (value !== undefined) sorted[key] = value;
  }
  await writeFile(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

const previousBaseline = await readBaseline();
const nextBaseline: Baseline = { ...previousBaseline };

let hasFailure = false;
for (const check of checks) {
  try {
    const { summary, count } = await check.run();
    const previous = previousBaseline[check.name];
    if (previous === undefined) {
      console.log(`ok   ${check.name}: ${summary} (first run, recording ${count})`);
    } else {
      const floor = previous * DRIFT_THRESHOLD;
      if (count < floor) {
        hasFailure = true;
        console.error(
          `FAIL ${check.name}: row-count drift — previous=${previous}, new=${count} (below ${DRIFT_THRESHOLD * 100}% floor of ${floor.toFixed(1)})`,
        );
      } else {
        console.log(`ok   ${check.name}: ${summary} (previous=${previous})`);
      }
    }
    // Always record the new count, even on drift failure — operators can
    // inspect the baseline file in the artifact to see what was observed.
    nextBaseline[check.name] = count;
  } catch (error) {
    hasFailure = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${check.name}: ${message}`);
  }
}

try {
  await writeBaseline(nextBaseline);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`warn: failed to write ${BASELINE_PATH}: ${message}`);
}

if (hasFailure) {
  process.exitCode = 1;
}
