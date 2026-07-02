/**
 * Targeted probe for AFL 2011 and 2012 H&A boundary.
 * Uses same heuristics as scripts/probe-afl-coaches.ts.
 * Run: bun run scripts/probe-2011-2012.ts
 */

import { parseCoachesVotesHtml } from "../src/sources/afl-coaches";

const HA_BASE =
  "https://aflcoaches.com.au/awards/the-aflca-champion-player-of-the-year-award/leaderboard/";
const FINALS_BASE =
  "https://aflcoaches.com.au/awards/gary-ayres-award-best-finals-player/leaderboard/";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const POLITENESS_MS = 500;

function buildUrl(base: string, season: number, round: number): string {
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
    const votes = parseCoachesVotesHtml(html, season, round, "AFLM");
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

// 2011: Gold Coast joined → 17 teams → 24 H&A rounds expected
// 2012: reverted to 23 H&A rounds expected
const SEASONS = [2011, 2012];
const PROBE_ROUNDS = [21, 22, 23, 24, 25, 26, 27];

console.log(
  `${"season".padEnd(6)} ${"round".padEnd(5)} ${"url-kind".padEnd(9)} ${"status".padEnd(10)} ${"votes".padEnd(7)} col2`,
);
console.log(
  `${"─".repeat(6)} ${"─".repeat(5)} ${"─".repeat(9)} ${"─".repeat(10)} ${"─".repeat(7)} ────`,
);

for (const season of SEASONS) {
  for (const round of PROBE_ROUNDS) {
    const haUrl = buildUrl(HA_BASE, season, round);
    const haResult = await probeUrl(haUrl, season, round);
    console.log(
      `${String(season).padEnd(6)} ${String(round).padStart(5)} ${"H&A".padEnd(9)} ${haResult.status.padEnd(10)} ${String(haResult.voteCount).padEnd(7)} ${haResult.col2Count}`,
    );
    await sleep(POLITENESS_MS);

    const finalsUrl = buildUrl(FINALS_BASE, season, round);
    const finalsResult = await probeUrl(finalsUrl, season, round);
    console.log(
      `${String(season).padEnd(6)} ${String(round).padStart(5)} ${"finals".padEnd(9)} ${finalsResult.status.padEnd(10)} ${String(finalsResult.voteCount).padEnd(7)} ${finalsResult.col2Count}`,
    );
    await sleep(POLITENESS_MS);
  }
  console.log("─".repeat(54));
}
