/**
 * End-to-end comparison test: fitzRoy R vs fitzRoy-ts.
 *
 * 1. Runs load-r.R  → reference.db
 * 2. Runs load-ts.ts → fitzroy.db
 * 3. Runs 25 comparison queries and reports PASS/FAIL
 *
 * Usage: bun run comparison/test.ts [--skip-r] [--skip-ts]
 *
 * Flags:
 *   --skip-r   Skip R load (reuse existing reference.db)
 *   --skip-ts  Skip TS load (reuse existing fitzroy.db)
 */
import { Database } from "bun:sqlite";
import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dir;
const REF_PATH = join(DIR, "reference.db");
const FIT_PATH = join(DIR, "fitzroy.db");
const LOAD_R = join(DIR, "load-r.R");
const LOAD_TS = join(DIR, "load-ts.ts");

const args = process.argv.slice(2);
const skipR = args.includes("--skip-r");
const skipTs = args.includes("--skip-ts");

// ---- Step 1: Run load scripts ----------------------------------------------

function runLoadR() {
  console.log("=".repeat(80));
  console.log("STEP 1a: Loading data via fitzRoy R package...");
  console.log("=".repeat(80));
  const start = performance.now();
  const result = spawnSync("Rscript", [LOAD_R], {
    stdio: "inherit",
    timeout: 600_000,
  });
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`\nR load script failed (exit ${result.status}) after ${elapsed}s`);
    process.exit(1);
  }
  console.log(`\nR load completed in ${elapsed}s\n`);
}

async function runLoadTs() {
  console.log("=".repeat(80));
  console.log("STEP 1b: Loading data via fitzRoy-ts...");
  console.log("=".repeat(80));
  const start = performance.now();
  const result = spawnSync("bun", ["run", LOAD_TS], {
    stdio: "inherit",
    timeout: 600_000,
  });
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`\nTS load script failed (exit ${result.status}) after ${elapsed}s`);
    process.exit(1);
  }
  console.log(`\nTS load completed in ${elapsed}s\n`);
}

// ---- Step 2: Comparison queries -------------------------------------------

// Cross-system team name normalization — map both R and TS variants to a common form.
// R passes through raw API names (e.g. "GWS GIANTS"), TS normalises them (e.g. "GWS Giants").
const TEAM_NAME_MAP: Record<string, string> = {
  // TS canonical → common
  "Adelaide Crows": "Adelaide",
  "Geelong Cats": "Geelong",
  "Gold Coast Suns": "Gold Coast",
  "Sydney Swans": "Sydney",
  "West Coast Eagles": "West Coast",
  "GWS Giants": "GWS",
  // R raw API names → common
  "GWS GIANTS": "GWS",
  "Gold Coast SUNS": "Gold Coast",
};

interface QueryDef {
  name: string;
  description: string;
  sql: string;
  normalizeTeams?: boolean;
  mode?: "exact" | "value" | "set";
}

const QUERIES: QueryDef[] = [
  // A. Match Counts (1-5)
  {
    name: "Q01: Total match count",
    description: "All matches across 2024-2025",
    sql: "SELECT COUNT(*) as count FROM matches",
    mode: "value",
  },
  {
    name: "Q02: Matches per round count",
    description: "Total matches grouped by round_number",
    sql: "SELECT round_number, COUNT(*) as count FROM matches GROUP BY round_number ORDER BY round_number",
    mode: "exact",
  },
  {
    name: "Q03: Matches with scores",
    description: "Matches where both teams have non-null points",
    sql: "SELECT COUNT(*) as count FROM matches WHERE home_points IS NOT NULL AND away_points IS NOT NULL",
    mode: "value",
  },
  {
    name: "Q04: Matches with quarter scores",
    description: "Matches with Q1 home goals populated",
    sql: "SELECT COUNT(*) as count FROM matches WHERE home_q1_goals IS NOT NULL",
    mode: "value",
  },
  {
    name: "Q05: Distinct venue count",
    description: "Number of distinct venues used",
    sql: "SELECT COUNT(DISTINCT name) as count FROM venues",
    mode: "value",
  },

  // B. Score Accuracy (6-10)
  {
    name: "Q06: Total season points",
    description: "Sum of all home + away points",
    sql: "SELECT SUM(home_points) + SUM(away_points) as total FROM matches",
    mode: "value",
  },
  {
    name: "Q07: Points by team",
    description: "Total points scored by each team",
    sql: `SELECT t.name,
           SUM(CASE WHEN m.home_team_id = t.id THEN m.home_points
                    WHEN m.away_team_id = t.id THEN m.away_points END) as total_points
         FROM matches m
         JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
         GROUP BY t.name ORDER BY t.name`,
    normalizeTeams: true,
    mode: "exact",
  },
  {
    name: "Q08: Full margin comparison",
    description: "Every match date + margin — the core integrity check",
    sql: `SELECT m.date, ht.name as home, at.name as away, m.margin
         FROM matches m
         JOIN teams ht ON ht.id = m.home_team_id
         JOIN teams at ON at.id = m.away_team_id
         ORDER BY m.date, ht.name`,
    normalizeTeams: true,
    mode: "exact",
  },
  {
    name: "Q09: Draw count",
    description: "Number of drawn matches",
    sql: "SELECT COUNT(*) as count FROM matches WHERE margin = 0",
    mode: "value",
  },
  {
    name: "Q10: Top 5 largest margins",
    description: "Spot-check extreme margins",
    sql: `SELECT m.date, ht.name as home, at.name as away, m.margin
         FROM matches m
         JOIN teams ht ON ht.id = m.home_team_id
         JOIN teams at ON at.id = m.away_team_id
         ORDER BY ABS(m.margin) DESC LIMIT 5`,
    normalizeTeams: true,
    mode: "exact",
  },

  // C. Player Stat Completeness (11-15)
  {
    name: "Q11: Total player_match_stats rows",
    description: "Total stat rows across both seasons",
    sql: "SELECT COUNT(*) as count FROM player_match_stats",
    mode: "value",
  },
  {
    name: "Q12: Distinct player count",
    description: "Unique players with stats",
    sql: "SELECT COUNT(DISTINCT player_id) as count FROM player_match_stats",
    mode: "value",
  },
  {
    name: "Q13: Stats per match distribution",
    description: "Min/max/avg stats rows per match",
    sql: `SELECT MIN(c) as min_stats, MAX(c) as max_stats, ROUND(AVG(c), 1) as avg_stats
         FROM (SELECT match_id, COUNT(*) as c FROM player_match_stats GROUP BY match_id)`,
    mode: "exact",
  },
  {
    name: "Q14: Rows with NULL core stats",
    description: "Stats rows missing kicks or disposals",
    sql: "SELECT COUNT(*) as count FROM player_match_stats WHERE kicks IS NULL OR disposals IS NULL",
    mode: "value",
  },
  {
    name: "Q15: Extended stats coverage",
    description: "Rows with non-null pressure_acts",
    sql: "SELECT COUNT(*) as count FROM player_match_stats WHERE pressure_acts IS NOT NULL",
    mode: "value",
  },

  // D. Statistical Aggregates (16-20)
  {
    name: "Q16: Season stat totals",
    description: "Sum of major stat columns",
    sql: `SELECT SUM(kicks) as kicks, SUM(handballs) as handballs, SUM(disposals) as disposals,
           SUM(goals) as goals, SUM(behinds) as behinds, SUM(tackles) as tackles, SUM(marks) as marks
         FROM player_match_stats`,
    mode: "exact",
  },
  {
    name: "Q17: Goals per team",
    description: "Total player goals by team",
    sql: `SELECT t.name, SUM(pms.goals) as total_goals
         FROM player_match_stats pms
         JOIN teams t ON t.id = pms.team_id
         GROUP BY t.name ORDER BY t.name`,
    normalizeTeams: true,
    mode: "exact",
  },
  {
    name: "Q18: Top 10 disposal getters",
    description: "Top 10 players by total disposals",
    sql: `SELECT p.surname, SUM(pms.disposals) as total
         FROM player_match_stats pms
         JOIN players p ON p.id = pms.player_id
         GROUP BY pms.player_id ORDER BY total DESC LIMIT 10`,
    mode: "exact",
  },
  {
    name: "Q19: Top 10 goal kickers",
    description: "Top 10 players by total goals",
    sql: `SELECT p.surname, SUM(pms.goals) as total
         FROM player_match_stats pms
         JOIN players p ON p.id = pms.player_id
         GROUP BY pms.player_id ORDER BY total DESC LIMIT 10`,
    mode: "exact",
  },
  {
    name: "Q20: Average disposals per match by team",
    description: "Team average disposals per player per match",
    sql: `SELECT t.name, ROUND(AVG(pms.disposals), 1) as avg_disposals
         FROM player_match_stats pms
         JOIN teams t ON t.id = pms.team_id
         GROUP BY t.name ORDER BY t.name`,
    normalizeTeams: true,
    mode: "exact",
  },

  // E. Data Quality Edge Cases (21-25)
  {
    name: "Q21: Team name list",
    description: "All team names that appear in matches (after normalization)",
    sql: `SELECT DISTINCT t.name FROM teams t
         WHERE t.id IN (SELECT home_team_id FROM matches UNION SELECT away_team_id FROM matches)
         ORDER BY t.name`,
    normalizeTeams: true,
    mode: "set",
  },
  {
    name: "Q22: Top 20 players by games",
    description: "Player name + game count for most-played",
    sql: `SELECT p.surname, COUNT(*) as games
         FROM player_match_stats pms
         JOIN players p ON p.id = pms.player_id
         GROUP BY pms.player_id ORDER BY games DESC, p.surname LIMIT 20`,
    mode: "exact",
  },
  {
    name: "Q23: Clearances consistency",
    description: "Sum(centre + stoppage) vs Sum(total clearances)",
    sql: `SELECT SUM(centre_clearances) as centre, SUM(stoppage_clearances) as stoppage,
           SUM(clearances) as total
         FROM player_match_stats`,
    mode: "exact",
  },
  {
    name: "Q24: Fantasy points total",
    description: "Sum of AFL fantasy scores",
    sql: "SELECT SUM(afl_fantasy_score) as total FROM player_match_stats",
    mode: "value",
  },
  {
    name: "Q25: Hitouts-to-advantage coverage",
    description: "Rows with hitouts_to_advantage non-null where hitouts > 0",
    sql: "SELECT COUNT(*) as count FROM player_match_stats WHERE hitouts_to_advantage IS NOT NULL AND hitouts > 0",
    mode: "value",
  },
];

// ---- comparison logic ------------------------------------------------------

function normalizeTeamName(name: string): string {
  return TEAM_NAME_MAP[name] ?? name;
}

function normalizeRow(
  row: Record<string, unknown>,
  shouldNormalize: boolean,
): Record<string, unknown> {
  if (!shouldNormalize) return row;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = typeof value === "string" ? normalizeTeamName(value) : value;
  }
  return normalized;
}

function rowsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const keyA = keysA[i];
    const keyB = keysB[i];
    if (keyA !== keyB || keyA === undefined || keyB === undefined) return false;
    const va = a[keyA];
    const vb = b[keyB];
    if (typeof va === "number" && typeof vb === "number") {
      if (Math.abs(va - vb) > 0.1) return false;
    } else if (va !== vb) {
      return false;
    }
  }
  return true;
}

function compareResults(
  refRows: Record<string, unknown>[],
  fitRows: Record<string, unknown>[],
  query: QueryDef,
): { pass: boolean; details: string } {
  const normalize = query.normalizeTeams ?? false;
  const refNorm = refRows.map((r) => normalizeRow(r, normalize));
  const fitNorm = fitRows.map((r) => normalizeRow(r, normalize));

  if (query.mode === "value") {
    const refVal = refNorm[0] ? Object.values(refNorm[0])[0] : null;
    const fitVal = fitNorm[0] ? Object.values(fitNorm[0])[0] : null;
    if (refVal === fitVal) {
      return { pass: true, details: `Value: ${refVal}` };
    }
    return { pass: false, details: `R: ${refVal}, TS: ${fitVal}` };
  }

  if (query.mode === "set") {
    const refSet = new Set(refNorm.map((r) => JSON.stringify(r)));
    const fitSet = new Set(fitNorm.map((r) => JSON.stringify(r)));
    const onlyRef = [...refSet].filter((r) => !fitSet.has(r));
    const onlyFit = [...fitSet].filter((r) => !refSet.has(r));
    if (onlyRef.length === 0 && onlyFit.length === 0) {
      return { pass: true, details: `${refSet.size} items match` };
    }
    let details = `R has ${refSet.size}, TS has ${fitSet.size}.`;
    if (onlyRef.length > 0) details += `\n    Only in R: ${onlyRef.slice(0, 5).join(", ")}`;
    if (onlyFit.length > 0) details += `\n    Only in TS: ${onlyFit.slice(0, 5).join(", ")}`;
    return { pass: false, details };
  }

  // "exact" mode
  if (refNorm.length !== fitNorm.length) {
    let details = `Row count: R=${refNorm.length}, TS=${fitNorm.length}`;
    const maxShow = Math.min(refNorm.length, fitNorm.length, 5);
    for (let i = 0; i < maxShow; i++) {
      const refRow = refNorm[i];
      const fitRow = fitNorm[i];
      if (refRow && fitRow && !rowsEqual(refRow, fitRow)) {
        details += `\n    Row ${i}: R=${JSON.stringify(refRow)} TS=${JSON.stringify(fitRow)}`;
      }
    }
    return { pass: false, details };
  }

  const diffs: string[] = [];
  for (let i = 0; i < refNorm.length; i++) {
    const refRow = refNorm[i];
    const fitRow = fitNorm[i];
    if (refRow && fitRow && !rowsEqual(refRow, fitRow)) {
      if (diffs.length < 10) {
        diffs.push(`Row ${i}: R=${JSON.stringify(refRow)} TS=${JSON.stringify(fitRow)}`);
      }
    }
  }

  if (diffs.length === 0) {
    return { pass: true, details: `${refNorm.length} rows match` };
  }
  return { pass: false, details: `${diffs.length} differences:\n    ${diffs.join("\n    ")}` };
}

// ---- main ------------------------------------------------------------------

async function main() {
  // Step 1: Load data
  if (!skipR) {
    runLoadR();
  } else {
    console.log("Skipping R load (--skip-r). Using existing reference.db\n");
  }

  if (!skipTs) {
    await runLoadTs();
  } else {
    console.log("Skipping TS load (--skip-ts). Using existing fitzroy.db\n");
  }

  // Verify both DBs exist
  if (!existsSync(REF_PATH)) {
    console.error(`reference.db not found at ${REF_PATH}`);
    process.exit(1);
  }
  if (!existsSync(FIT_PATH)) {
    console.error(`fitzroy.db not found at ${FIT_PATH}`);
    process.exit(1);
  }

  // Step 2: Run comparison
  console.log("=".repeat(80));
  console.log("STEP 2: COMPARISON — fitzRoy R vs fitzRoy-ts");
  console.log("=".repeat(80));
  console.log();

  // Open in read-write first to checkpoint WAL, then switch to readonly queries
  const refDb = new Database(REF_PATH);
  refDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const fitDb = new Database(FIT_PATH);
  fitDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");

  let passed = 0;
  let failed = 0;

  for (const query of QUERIES) {
    const refRows = refDb.prepare(query.sql).all() as Record<string, unknown>[];
    const fitRows = fitDb.prepare(query.sql).all() as Record<string, unknown>[];
    const result = compareResults(refRows, fitRows, query);

    const status = result.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
    console.log(`[${status}] ${query.name}`);
    console.log(`  ${query.description}`);
    console.log(`  ${result.details}`);
    console.log();

    if (result.pass) passed++;
    else failed++;
  }

  console.log("=".repeat(80));
  console.log(
    `\nResults: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m out of ${QUERIES.length}`,
  );
  console.log();

  refDb.close();
  fitDb.close();

  // Cleanup: remove generated databases
  console.log("Cleaning up...");
  for (const f of [REF_PATH, FIT_PATH]) {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = f + suffix;
      if (existsSync(p)) {
        try {
          unlinkSync(p);
        } catch {
          // Best-effort cleanup
        }
      }
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
