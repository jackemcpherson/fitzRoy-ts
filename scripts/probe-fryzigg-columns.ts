/**
 * Fryzigg full column inventory probe (Plan 031).
 *
 * Fetches AFLM and AFLW dumps and prints a full column inventory:
 * name, inferred type, null-rate (%), sample value.
 *
 * Run: bun run scripts/probe-fryzigg-columns.ts
 */

import { isDataFrame, parseRds } from "@jackemcpherson/rds-js";

const USER_AGENT = "fitzRoy-ts/1.0 probe (https://github.com/jackemcpherson/fitzRoy-ts)";

const DUMP_URLS: Record<string, string> = {
  AFLM: "http://www.fryziggafl.net/static/fryziggafl.rds",
  AFLW: "http://www.fryziggafl.net/static/aflw_player_stats.rds",
};

// Columns that the typed transform already consumes (mapped to PlayerStats)
const TYPED_COLUMNS_AFLM = new Set([
  "match_id",
  "match_date",
  "match_home_team",
  "match_away_team",
  "player_team",
  "match_round",
  "guernsey_number",
  "player_id",
  "player_first_name",
  "player_last_name",
  "kicks",
  "handballs",
  "disposals",
  "marks",
  "goals",
  "behinds",
  "tackles",
  "hitouts",
  "free_kicks_for",
  "free_kicks_against",
  "contested_possessions",
  "uncontested_possessions",
  "contested_marks",
  "intercepts",
  "centre_clearances",
  "stoppage_clearances",
  "clearances",
  "inside_fifties",
  "rebounds",
  "clangers",
  "turnovers",
  "one_percenters",
  "bounces",
  "goal_assists",
  "disposal_efficiency_percentage",
  "metres_gained",
  "marks_inside_fifty",
  "tackles_inside_fifty",
  "shots_at_goal",
  "score_involvements",
  "time_on_ground_percentage",
  "rating_points",
  "player_position",
  "brownlow_votes",
  "supercoach_score",
  "afl_fantasy_score",
  "effective_disposals",
  "effective_kicks",
  "pressure_acts",
  "def_half_pressure_acts",
  "spoils",
  "hitouts_to_advantage",
  "hitout_win_percentage",
  "ground_ball_gets",
  "f50_ground_ball_gets",
  "intercept_marks",
  "marks_on_lead",
  "contest_off_one_on_ones",
  "contest_off_wins",
  "contest_def_one_on_ones",
  "contest_def_losses",
  "ruck_contests",
  "score_launches",
]);

const TYPED_COLUMNS_AFLW = new Set([
  "match_id",
  "date",
  "home_team",
  "away_team",
  "team",
  "fixture_round",
  "number",
  "player_id",
  "player_name",
  "kicks",
  "handballs",
  "disposals",
  "marks",
  "goals",
  "behinds",
  "tackles",
  "hitouts",
  "frees_for",
  "frees_against",
  "contested_possessions",
  "uncontested_possessions",
  "contested_marks",
  "intercepts",
  "centre_clearances",
  "stoppage_clearances",
  "total_clearances",
  "inside50s",
  "rebound50s",
  "clangers",
  "turnovers",
  "one_percenters",
  "bounces",
  "goal_assists",
  "disposal_efficiency",
  "metres_gained",
  "marks_inside50",
  "tackles_inside50",
  "shots_at_goal",
  "score_involvements",
  "total_possessions",
  "time_on_ground",
  "rating_points",
  "position",
  "brownlow_votes",
  "supercoach_score",
  "fantasy_score",
  "effective_disposals",
  "effective_kicks",
  "pressure_acts",
  "def_half_pressure_acts",
  "spoils",
  "hitouts_to_advantage",
  "hitout_win_percentage",
  "ground_ball_gets",
  "f50_ground_ball_gets",
  "intercept_marks",
  "marks_on_lead",
  "contest_off_one_on_ones",
  "contest_off_wins",
  "contest_def_one_on_ones",
  "contest_def_losses",
  "ruck_contests",
  "score_launches",
]);

function inferType(col: unknown[]): string {
  let hasNum = false;
  let hasStr = false;
  let hasBool = false;
  let hasNull = false;
  for (const v of col) {
    if (v === null || v === undefined) {
      hasNull = true;
    } else if (typeof v === "number") {
      hasNum = true;
    } else if (typeof v === "string") {
      hasStr = true;
    } else if (typeof v === "boolean") {
      hasBool = true;
    }
  }
  const types: string[] = [];
  if (hasNum) types.push("number");
  if (hasStr) types.push("string");
  if (hasBool) types.push("boolean");
  if (hasNull) types.push("null");
  return types.join("|") || "empty";
}

function nullRate(col: unknown[]): number {
  if (col.length === 0) return 100;
  let nulls = 0;
  for (const v of col) {
    if (v === null || v === undefined) nulls++;
  }
  return (nulls / col.length) * 100;
}

function sampleValue(col: unknown[]): string {
  for (const v of col) {
    if (v !== null && v !== undefined) {
      const s = String(v);
      return s.length > 40 ? `${s.slice(0, 40)}…` : s;
    }
  }
  return "(all null)";
}

async function fetchAndParse(competition: string, url: string) {
  console.log(`\nFetching ${competition} dump...`);
  const t0 = Date.now();
  const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  console.log(`  Downloaded ${(buf.length / 1_048_576).toFixed(2)} MB in ${Date.now() - t0} ms`);

  const parsed = await parseRds(buf);
  if (!isDataFrame(parsed)) throw new Error("RDS did not yield a DataFrame");
  return parsed;
}

// Columns AFL-MCP enrich-fryzigg.ts accesses directly (beyond what typed transform uses)
const AFL_MCP_COLUMNS = new Set(["match_weather_temp_c", "match_weather_type", "match_local_time"]);

// Player biography hints
const BIO_HINTS = /dob|birth|height|weight|age|retire|position|draft/i;
// Match-context hints
const MATCH_HINTS = /^match_|weather|venue|crowd|attendance|local_time|temperature/i;
// ID/join key hints
const ID_HINTS = /^.*_id$|^id$/i;

function classifyColumn(
  name: string,
  typedSet: Set<string>,
  _sample: string,
  _type: string,
): string {
  if (typedSet.has(name)) return "A-typed";
  if (MATCH_HINTS.test(name)) return "B-match-context";
  if (BIO_HINTS.test(name)) return "C-player-bio";
  if (ID_HINTS.test(name)) return "D-id-joinkey";
  return "E-other";
}

async function probeCompetition(competition: string, url: string): Promise<void> {
  const frame = await fetchAndParse(competition, url);
  const typedSet = competition === "AFLM" ? TYPED_COLUMNS_AFLM : TYPED_COLUMNS_AFLW;

  const nRows = frame.columns[0]?.length ?? 0;
  console.log(`  Rows: ${nRows.toLocaleString()}, Columns: ${frame.names.length}`);

  // Column inventory
  const rows: {
    name: string;
    type: string;
    nullPct: number;
    sample: string;
    class: string;
    aflMcp: boolean;
  }[] = [];

  for (let i = 0; i < frame.names.length; i++) {
    const name = frame.names[i] ?? `col_${i}`;
    const col = (frame.columns[i] ?? []) as unknown[];
    const type = inferType(col);
    const nullPct = nullRate(col);
    const sample = sampleValue(col);
    const cls = classifyColumn(name, typedSet, sample, type);
    const aflMcp = AFL_MCP_COLUMNS.has(name);
    rows.push({ name, type, nullPct, sample, class: cls, aflMcp });
  }

  // Sort by classification
  rows.sort((a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));

  // Print table
  console.log(`\n${"=".repeat(120)}`);
  console.log(
    `${competition} Column Inventory (${frame.names.length} columns, ${nRows.toLocaleString()} rows)`,
  );
  console.log(`${"=".repeat(120)}`);
  console.log(
    `${"CLASS".padEnd(16)} ${"COLUMN NAME".padEnd(40)} ${"TYPE".padEnd(20)} ${"NULL%".padStart(6)} ${"AFL-MCP".padEnd(8)} SAMPLE`,
  );
  console.log("-".repeat(120));

  for (const r of rows) {
    const nullStr = r.nullPct.toFixed(1).padStart(6);
    const aflMcpStr = r.aflMcp ? "yes" : "";
    const line = `${r.class.padEnd(16)} ${r.name.padEnd(40)} ${r.type.padEnd(20)} ${nullStr} ${aflMcpStr.padEnd(8)} ${r.sample}`;
    console.log(line);
  }

  // Counts per class
  const classCounts = new Map<string, number>();
  for (const r of rows) {
    classCounts.set(r.class, (classCounts.get(r.class) ?? 0) + 1);
  }
  console.log("\n--- Classification summary ---");
  for (const [cls, count] of [...classCounts.entries()].sort()) {
    console.log(`  ${cls}: ${count}`);
  }

  // DOB check
  const dobCol = frame.names.find((n) => /dob|birth/i.test(n));
  console.log(`\n--- DOB column: ${dobCol ?? "(none found)"} ---`);
  if (dobCol) {
    const idx = frame.names.indexOf(dobCol);
    const col = (frame.columns[idx] ?? []) as unknown[];
    console.log(`  Null rate: ${nullRate(col).toFixed(1)}%`);
    console.log(`  Sample: ${sampleValue(col)}`);
  }

  // match_id uniqueness check (for join-key analysis)
  const matchIdIdx = frame.names.indexOf("match_id");
  if (matchIdIdx >= 0) {
    const matchIdCol = (frame.columns[matchIdIdx] ?? []) as unknown[];
    const uniqueMatchIds = new Set(matchIdCol.filter((v) => v !== null)).size;
    console.log(
      `\n--- match_id uniqueness: ${uniqueMatchIds} unique values across ${nRows} rows ---`,
    );
    const sample3 = matchIdCol.filter((v) => v !== null).slice(0, 3);
    console.log(`  Sample match_ids: ${sample3.join(", ")}`);
  }
}

// Main
console.log("=== Fryzigg full column inventory probe (Plan 031) ===");
console.log(`  Probing at: ${new Date().toISOString()}`);

for (const [competition, url] of Object.entries(DUMP_URLS)) {
  await probeCompetition(competition, url);
}

console.log("\n=== Probe complete ===");
