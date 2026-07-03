/**
 * Probe script: Verify every AFL Tables team slug against both URL shapes.
 *
 * Purpose: confirm the slug map in `src/sources/afl-tables.ts` resolves to
 * real pages for all 20 teams.  Two URL shapes are checked per team:
 *   - alltime : https://afltables.com/afl/stats/alltime/${slug}.html  (actually used in code)
 *   - team-idx: https://afltables.com/afl/teams/${slug}_idx.html      (mentioned in comments)
 *
 * For any FAIL the script also tries the obvious corrections and reports the
 * first one that resolves so the fix can be applied to the map.
 *
 * Run: bun run scripts/probe-afl-tables-slugs.ts
 *
 * ─── Findings (run 2026-07-02) ──────────────────────────────────────────────
 *
 * Team                slug (map)  url-kind   result
 * ─────────────────── ─────────── ────────── ──────────────────────────────
 * Adelaide Crows       adelaide    alltime    PASS 200
 * Adelaide Crows       adelaide    team-idx   PASS 200
 * Brisbane Lions       brisbane    alltime    FAIL 404 → brisbanel PASS 200
 * Brisbane Lions       brisbane    team-idx   FAIL 404 → brisbanel PASS 200
 * Carlton              carlton     alltime    PASS 200
 * Carlton              carlton     team-idx   PASS 200
 * Collingwood          collingwood alltime    PASS 200
 * Collingwood          collingwood team-idx   PASS 200
 * Essendon             essendon    alltime    PASS 200
 * Essendon             essendon    team-idx   PASS 200
 * Fremantle            fremantle   alltime    PASS 200
 * Fremantle            fremantle   team-idx   PASS 200
 * Geelong Cats         geelong     alltime    PASS 200
 * Geelong Cats         geelong     team-idx   PASS 200
 * Gold Coast Suns      goldcoast   alltime    PASS 200
 * Gold Coast Suns      goldcoast   team-idx   PASS 200
 * GWS Giants           gws         alltime    PASS 200
 * GWS Giants           gws         team-idx   PASS 200
 * Hawthorn             hawthorn    alltime    PASS 200
 * Hawthorn             hawthorn    team-idx   PASS 200
 * Melbourne            melbourne   alltime    PASS 200
 * Melbourne            melbourne   team-idx   PASS 200
 * North Melbourne      kangaroos   alltime    PASS 200
 * North Melbourne      kangaroos   team-idx   PASS 200
 * Port Adelaide        padelaide   alltime    PASS 200
 * Port Adelaide        padelaide   team-idx   PASS 200
 * Richmond             richmond    alltime    PASS 200
 * Richmond             richmond    team-idx   PASS 200
 * St Kilda             stkilda     alltime    PASS 200
 * St Kilda             stkilda     team-idx   PASS 200
 * Sydney Swans         swans       alltime    PASS 200
 * Sydney Swans         swans       team-idx   PASS 200
 * West Coast Eagles    westcoast   alltime    PASS 200
 * West Coast Eagles    westcoast   team-idx   PASS 200
 * Western Bulldogs     bullldogs   alltime    PASS 200
 * Western Bulldogs     bullldogs   team-idx   PASS 200
 * Fitzroy              fitzroy     alltime    PASS 200
 * Fitzroy              fitzroy     team-idx   PASS 200
 * University           university  alltime    PASS 200
 * University           university  team-idx   PASS 200
 *
 * CONCLUSION:
 *   Only one slug is wrong: "Brisbane Lions" maps to "brisbane" but the
 *   correct slug is "brisbanel" (distinguishes Lions from Brisbane Bears
 *   "brisbaneb").  All other slugs pass both URL shapes including
 *   "bullldogs" (triple-L) which is afltables.com's own spelling.
 *   Both URL shapes use the same slug family — no split-slug issue.
 *
 *   Fix applied: AFL_TABLES_SLUG_MAP "Brisbane Lions" → "brisbanel"
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Minimum delay between HTTP requests (polite scraping). */
const POLITENESS_MS = 500;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** The current slug map entries from src/sources/afl-tables.ts */
const SLUG_MAP: ReadonlyArray<readonly [string, string]> = [
  ["Adelaide Crows", "adelaide"],
  ["Brisbane Lions", "brisbane"],
  ["Carlton", "carlton"],
  ["Collingwood", "collingwood"],
  ["Essendon", "essendon"],
  ["Fremantle", "fremantle"],
  ["Geelong Cats", "geelong"],
  ["Gold Coast Suns", "goldcoast"],
  ["GWS Giants", "gws"],
  ["Hawthorn", "hawthorn"],
  ["Melbourne", "melbourne"],
  ["North Melbourne", "kangaroos"],
  ["Port Adelaide", "padelaide"],
  ["Richmond", "richmond"],
  ["St Kilda", "stkilda"],
  ["Sydney Swans", "swans"],
  ["West Coast Eagles", "westcoast"],
  ["Western Bulldogs", "bullldogs"],
  ["Fitzroy", "fitzroy"],
  ["University", "university"],
] as const;

/** Candidate corrections to try when a slug fails. */
const CORRECTIONS: ReadonlyRecord<string, readonly string[]> = {
  brisbane: ["brisbanel", "brisbaneb", "brisbanelions"],
};

type ReadonlyRecord<K extends string, V> = Readonly<Record<K, V>>;

function alltimeUrl(slug: string): string {
  return `https://afltables.com/afl/stats/alltime/${slug}.html`;
}

function teamIdxUrl(slug: string): string {
  return `https://afltables.com/afl/teams/${slug}_idx.html`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeSlug(slug: string, urlFn: (s: string) => string): Promise<number> {
  const url = urlFn(slug);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    return res.status;
  } catch (e) {
    console.error(`  fetch error for ${url}: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
}

const urlKinds: ReadonlyArray<readonly [string, (s: string) => string]> = [
  ["alltime", alltimeUrl],
  ["team-idx", teamIdxUrl],
] as const;

console.log(
  `${"team".padEnd(20)} ${"slug".padEnd(11)} ${"url-kind".padEnd(10)} ${"status".padEnd(6)} correction`,
);
console.log(`${"─".repeat(20)} ${"─".repeat(11)} ${"─".repeat(10)} ${"─".repeat(6)} ──────────`);

let anyUnresolved = false;

for (const [team, slug] of SLUG_MAP) {
  for (const [kind, urlFn] of urlKinds) {
    const status = await probeSlug(slug, urlFn);
    await sleep(POLITENESS_MS);

    if (status === 200) {
      console.log(`${team.padEnd(20)} ${slug.padEnd(11)} ${kind.padEnd(10)} ${"PASS".padEnd(6)}`);
    } else {
      // Try corrections
      const candidates = CORRECTIONS[slug] ?? [];
      let correctedSlug: string | undefined;
      let correctedStatus = 0;

      for (const candidate of candidates) {
        correctedStatus = await probeSlug(candidate, urlFn);
        await sleep(POLITENESS_MS);
        if (correctedStatus === 200) {
          correctedSlug = candidate;
          break;
        }
      }

      if (correctedSlug !== undefined) {
        console.log(
          `${team.padEnd(20)} ${slug.padEnd(11)} ${kind.padEnd(10)} ${`FAIL ${status}`.padEnd(6)} → ${correctedSlug} PASS ${correctedStatus}`,
        );
      } else {
        console.log(
          `${team.padEnd(20)} ${slug.padEnd(11)} ${kind.padEnd(10)} ${`FAIL ${status}`.padEnd(6)} NO CORRECTION FOUND`,
        );
        anyUnresolved = true;
      }
    }
  }
}

console.log("─".repeat(70));
if (anyUnresolved) {
  console.log("RESULT: FAIL — one or more teams have no working slug. STOP.");
  process.exit(1);
} else {
  console.log("RESULT: PASS — all teams resolve to a working slug for both URL shapes.");
}
