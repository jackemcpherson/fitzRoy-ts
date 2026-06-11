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
 */

import { AflApiClient } from "../src/sources/afl-api";
import { AflTablesClient } from "../src/sources/afl-tables";
import { FootyWireClient } from "../src/sources/footywire";
import { SquiggleClient } from "../src/sources/squiggle";

/** Previous season — guaranteed to have complete published data. */
const season = new Date().getUTCFullYear() - 1;

interface CanaryCheck {
  readonly name: string;
  /** Runs the probe; resolves to a one-line summary or throws on failure. */
  readonly run: () => Promise<string>;
}

const checks: readonly CanaryCheck[] = [
  {
    // Public no-auth endpoint exercising the CompseasonListSchema parse.
    name: "afl-api",
    run: async () => {
      const result = await new AflApiClient().resolveCompSeason("AFLM", season);
      if (!result.success) throw result.error;
      return `resolved AFLM ${season} to compseason id ${result.data}`;
    },
  },
  {
    name: "afl-tables",
    run: async () => {
      const result = await new AflTablesClient().fetchSeasonResults(season);
      if (!result.success) throw result.error;
      if (result.data.length === 0) throw new Error(`parsed 0 matches for ${season}`);
      return `parsed ${result.data.length} matches for ${season}`;
    },
  },
  {
    name: "footywire",
    run: async () => {
      const result = await new FootyWireClient().fetchSeasonResults(season);
      if (!result.success) throw result.error;
      if (result.data.length === 0) throw new Error(`parsed 0 matches for ${season}`);
      return `parsed ${result.data.length} matches for ${season}`;
    },
  },
  {
    name: "squiggle",
    run: async () => {
      const result = await new SquiggleClient().fetchGames(season, 1);
      if (!result.success) throw result.error;
      if (result.data.games.length === 0) throw new Error(`parsed 0 games for ${season} round 1`);
      return `parsed ${result.data.games.length} games for ${season} round 1`;
    },
  },
];

let hasFailure = false;
for (const check of checks) {
  try {
    const summary = await check.run();
    console.log(`ok   ${check.name}: ${summary}`);
  } catch (error) {
    hasFailure = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${check.name}: ${message}`);
  }
}

if (hasFailure) {
  process.exitCode = 1;
}
