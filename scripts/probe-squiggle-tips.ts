/**
 * Read-only probe for the Squiggle `q=tips` endpoint.
 *
 * Captures the field inventory for both post-game and pre-game tip rows,
 * identifies all model names, checks coverage range, and notes team-name
 * discrepancies against the canonical names in src/lib/team-mapping.ts.
 *
 * Polite: a small number of requests with ≥500 ms between each, using the
 * descriptive fitzRoy-ts User-Agent already established in the SquiggleClient.
 *
 * Run: `bun run scripts/probe-squiggle-tips.ts`
 */

const BASE = "https://api.squiggle.com.au/";
const USER_AGENT = "fitzRoy-ts/1.0 (https://github.com/jackemcpherson/fitzRoy-ts)";
const DELAY_MS = 600;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTips(params: Record<string, string | number>): Promise<unknown[]> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const url = `${BASE}?q=tips&${qs}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const json = (await response.json()) as { tips?: unknown[] };
  return json.tips ?? [];
}

function describeField(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    return Number.isFinite(Number(value))
      ? `string(numeric) e.g. "${value}"`
      : `string e.g. "${value}"`;
  }
  return `${typeof value} e.g. ${JSON.stringify(value)}`;
}

// ---------------------------------------------------------------------------
// Step 1: Field inventory on a completed round (2025 R18)
// ---------------------------------------------------------------------------
console.log("\n=== PROBE 1: Post-game tips (2025 R18) ===");
const tips2025r18 = await fetchTips({ year: 2025, round: 18 });
await sleep(DELAY_MS);

if (tips2025r18.length === 0) {
  console.error("STOP: no tips returned for 2025 R18");
  process.exitCode = 1;
} else {
  const sample = tips2025r18[0] as Record<string, unknown>;
  console.log(`Total tip rows: ${tips2025r18.length}`);
  console.log("\nField inventory (post-game):");
  for (const [key, value] of Object.entries(sample)) {
    console.log(`  ${key.padEnd(14)}: ${describeField(value)}`);
  }

  // Show one away-team-tipped row to illustrate margin sign convention
  const awayTip = (tips2025r18 as Record<string, unknown>[]).find((t) => t.tip !== t.hteam);
  if (awayTip) {
    console.log("\nAway-team-tipped row (margin sign check):");
    console.log(`  tip=${awayTip.tip}, hteam=${awayTip.hteam}, ateam=${awayTip.ateam}`);
    console.log(`  hmargin=${awayTip.hmargin} (negative = away team advantage)`);
    console.log(`  margin=${awayTip.margin} (positive = predicted winning margin for tipped team)`);
    console.log(`  confidence=${awayTip.confidence} (confidence in tipped team)`);
    console.log(
      `  hconfidence=${awayTip.hconfidence} (confidence in home team; <50 when away tipped)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Step 2: Pre-game field differences (2026 R18 — upcoming)
// ---------------------------------------------------------------------------
console.log("\n=== PROBE 2: Pre-game tips (2026 R18, upcoming) ===");
const tips2026r18 = await fetchTips({ year: 2026, round: 18 });
await sleep(DELAY_MS);

if (tips2026r18.length === 0) {
  console.log("No pre-game tips found for 2026 R18; round may not be scheduled yet.");
} else {
  const sample = tips2026r18[0] as Record<string, unknown>;
  console.log(`Total tip rows: ${tips2026r18.length}`);
  const nullFields = Object.entries(sample)
    .filter(([, v]) => v === null)
    .map(([k]) => k);
  console.log(`Fields null pre-game: [${nullFields.join(", ")}]`);
  const nonNullFields = Object.entries(sample)
    .filter(([, v]) => v !== null)
    .map(([k]) => k);
  console.log(`Fields populated pre-game: [${nonNullFields.join(", ")}]`);
}

// ---------------------------------------------------------------------------
// Step 3: Model inventory (2026 R1 — full field with all current models)
// ---------------------------------------------------------------------------
console.log("\n=== PROBE 3: Model inventory (2026 R1) ===");
const tips2026r1 = await fetchTips({ year: 2026, round: 1 });
await sleep(DELAY_MS);

if (tips2026r1.length > 0) {
  const models = new Map<number, string>();
  for (const tip of tips2026r1 as Record<string, unknown>[]) {
    const sid = tip.sourceid as number;
    const sname = tip.source as string;
    if (!models.has(sid)) models.set(sid, sname);
  }
  console.log(`Unique models in 2026 R1: ${models.size}`);
  for (const [sid, name] of [...models.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(sid).padStart(3)}: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Step 4: Coverage range (check earliest available year)
// ---------------------------------------------------------------------------
console.log("\n=== PROBE 4: Coverage range ===");
const testYears = [2017, 2018];
for (const year of testYears) {
  const tips = await fetchTips({ year, round: 1 });
  console.log(`  ${year} R1: ${tips.length} tips`);
  await sleep(DELAY_MS);
}

// ---------------------------------------------------------------------------
// Step 5: Team-name discrepancies
// ---------------------------------------------------------------------------
console.log("\n=== PROBE 5: Team names from Squiggle vs canonical ===");
// Use R1 2026 data already fetched
if (tips2026r1.length > 0) {
  const squiggleNames = new Set<string>();
  for (const tip of tips2026r1 as Record<string, unknown>[]) {
    squiggleNames.add(tip.hteam as string);
    squiggleNames.add(tip.ateam as string);
    squiggleNames.add(tip.tip as string);
  }
  const canonical: Record<string, string> = {
    Adelaide: "Adelaide Crows",
    Geelong: "Geelong Cats",
    "Gold Coast": "Gold Coast Suns",
    "Greater Western Sydney": "GWS Giants",
    Sydney: "Sydney Swans",
    "West Coast": "West Coast Eagles",
  };
  console.log("Names that differ from canonical (need normaliseTeamName):");
  for (const name of [...squiggleNames].sort()) {
    const canon = canonical[name];
    if (canon) {
      console.log(`  "${name}" → "${canon}"`);
    }
  }
  const passThrough = [...squiggleNames].sort().filter((n) => !canonical[n]);
  console.log("\nNames already canonical (pass-through):");
  for (const name of passThrough) {
    console.log(`  "${name}"`);
  }
}

console.log("\n=== Probe complete ===\n");
