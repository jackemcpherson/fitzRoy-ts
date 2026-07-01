/**
 * Probe script: AFLCA coaches-votes URL behaviour across seasons.
 *
 * Purpose: establish, per season, which rounds serve data on the H&A
 * (Champion Player) URL vs the Finals (Gary Ayres) URL, so we can build a
 * correct per-season finals-boundary table in src/sources/afl-coaches.ts.
 *
 * Run: bun run scripts/probe-afl-coaches.ts
 *
 * ─── Findings (run 2026-07-02) ──────────────────────────────────────────────
 *
 * The Gary Ayres (finals) URL shows a large jump in col-2 element count when
 * the first real finals week's data appears. Before that, the URL returns a
 * small pre-finals placeholder page (~6-8 col-2 elements). This jump is the
 * ground truth for when finals start, and therefore for the last H&A round.
 *
 * Key results — last H&A round per sampled season:
 *
 *   2010 → 22   (round 23+ returns HTTP 404 on both URLs)
 *   2011 → 24   (H&A returns DATA at round 24, HTTP 404 at round 25; Gary Ayres
 *                empty for all rounds — pre-2018 behaviour, no finals URL signal)
 *   2012 → 23   (H&A returns DATA at round 23, HTTP 404 at round 24; Gary Ayres
 *                empty for all rounds — matches DEFAULT_LAST_HA_ROUND)
 *   2015 → 23   (Gary Ayres always empty; H&A round 24+ = 404)
 *   2017 → 23   (Gary Ayres 404 at round 24; no finals data via URL)
 *   2019 → 23   (Gary Ayres big jump at round 24: 6→31 col-2)
 *   2023 → 24   (Gary Ayres big jump at round 25: 8→32 col-2)
 *   2024 → 25   (Gary Ayres big jump at round 26: 7→30 col-2)
 *   2025 → 25   (Gary Ayres big jump at round 26: 8→28 col-2)
 *
 * Finals structure confirmed (via Gary Ayres col-2 counts):
 *   2019: round 24 = QF/EF (~31), round 25 = SF (~14), round 26 = PF (~15),
 *          round 27 = GF (~6), round 28 = 404
 *   2023: round 25 = QF/EF (~32), round 26 = SF (~14), round 27 = PF (~16),
 *          round 28 = GF (~8)
 *   2024: round 26 = QF/EF (~30), round 27 = SF (~17), round 28 = PF (~16)
 *   2025: round 26 = QF/EF (~28), round 27 = SF (~15), round 28 = PF (~16)
 *
 * Pre-finals Gary Ayres URL behaviour:
 *   For rounds before finals start, the Gary Ayres URL returns a small
 *   placeholder page (6-8 col-2 elements). These are NOT real votes and must
 *   NOT be collected. The fix ensures we never request Gary Ayres for H&A
 *   rounds (isFinals=false for round ≤ lastHaRound).
 *
 * Pre-2018 Gary Ayres data:
 *   The Gary Ayres URL returns 404 for finals rounds in 2017, and the page
 *   is always empty in 2015. No usable Gary Ayres data found for pre-2018.
 *   For 2019+, Gary Ayres is available and the URL structure matches the
 *   existing buildUrl() logic.
 *
 * CONCLUSION — DEFAULT_LAST_HA_ROUND = 23 (covers 2012–2022)
 * Exception table (seasons that differ from the default):
 *   2006–2010: 22  (probe confirmed 2010; AFL ran 22 H&A rounds pre-2011)
 *   2011: 24        (probe confirmed — Gold Coast joined, 17 teams, 24 H&A rounds)
 *   2023: 24        (probe confirmed)
 *   2024: 25        (probe confirmed)
 *   2025: 25        (probe confirmed)
 *
 * Note on H&A URL deduplication:
 *   Accessing the H&A URL for a round after H&A ends returns the same
 *   leaderboard content as the last real H&A round (AFLCA serves stale
 *   data rather than 404). parseCoachesVotesHtml would stamp these as the
 *   later round — duplicate votes with wrong round numbers. The fix prevents
 *   this by never requesting H&A URL for finals rounds.
 *
 * Note on real AFLCA HTML:
 *   The live site uses class="col-2 text-center" (not just class="col-2").
 *   The CSS selector .col-2 in parseCoachesVotesHtml matches both forms —
 *   the parser works correctly on real HTML. The fixture uses simplified
 *   class="col-2" attributes, which also match.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { parseCoachesVotesHtml } from "../src/sources/afl-coaches";

const HA_BASE =
  "https://aflcoaches.com.au/awards/the-aflca-champion-player-of-the-year-award/leaderboard/";
const FINALS_BASE =
  "https://aflcoaches.com.au/awards/gary-ayres-award-best-finals-player/leaderboard/";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Seasons to probe — representative sample per the plan. */
const SEASONS = [2010, 2011, 2012, 2015, 2017, 2019, 2023, 2024, 2025];

/** Rounds to check per season — boundary region. */
const PROBE_ROUNDS = [22, 23, 24, 25, 26, 27, 28];

/** Minimum delay between HTTP requests (polite scraping). */
const POLITENESS_MS = 500;

function buildUrl(base: string, season: number, round: number): string {
  // Mirrors the logic in src/sources/afl-coaches.ts buildUrl()
  const secondPart = season >= 2023 ? season + 1 : season;
  const roundPad = String(round).padStart(2, "0");
  return `${base}${season}/${secondPart}01${roundPad}`;
}

async function probeUrl(
  url: string,
  season: number,
  round: number,
): Promise<{ status: string; voteCount: number; col2Count: number }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return { status: `HTTP ${res.status}`, voteCount: 0, col2Count: 0 };
    const html = await res.text();
    // Use the actual parser to count real vote rows (ground truth).
    const votes = parseCoachesVotesHtml(html, season, round, "AFLM");
    // Also count col-2 elements (including "col-2 text-center" etc.) as a
    // secondary signal — large counts indicate real data vs tiny placeholder.
    const col2Count = (html.match(/class="col-2[^"]*"/g) ?? []).length;
    return {
      status: votes.length > 0 ? "DATA" : "empty",
      voteCount: votes.length,
      col2Count,
    };
  } catch (e) {
    return {
      status: `ERR: ${e instanceof Error ? e.message : String(e)}`,
      voteCount: 0,
      col2Count: 0,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log(
  `${"season".padEnd(6)} ${"round".padEnd(5)} ${"url-kind".padEnd(9)} ${"status".padEnd(10)} ${"votes".padEnd(7)} col2`,
);
console.log(
  `${"─".repeat(6)} ${"─".repeat(5)} ${"─".repeat(9)} ${"─".repeat(10)} ${"─".repeat(7)} ────`,
);

for (const season of SEASONS) {
  for (const round of PROBE_ROUNDS) {
    // H&A (Champion Player) URL
    const haUrl = buildUrl(HA_BASE, season, round);
    const haResult = await probeUrl(haUrl, season, round);
    console.log(
      `${String(season).padEnd(6)} ${String(round).padStart(5)} ${"H&A".padEnd(9)} ${haResult.status.padEnd(10)} ${String(haResult.voteCount).padEnd(7)} ${haResult.col2Count}`,
    );
    await sleep(POLITENESS_MS);

    // Finals (Gary Ayres) URL
    const finalsUrl = buildUrl(FINALS_BASE, season, round);
    const finalsResult = await probeUrl(finalsUrl, season, round);
    console.log(
      `${String(season).padEnd(6)} ${String(round).padStart(5)} ${"finals".padEnd(9)} ${finalsResult.status.padEnd(10)} ${String(finalsResult.voteCount).padEnd(7)} ${finalsResult.col2Count}`,
    );
    await sleep(POLITENESS_MS);
  }
  console.log("─".repeat(54));
}
