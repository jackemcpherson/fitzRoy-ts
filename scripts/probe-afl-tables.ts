/**
 * Probe AFL Tables (and related sites) for historical coverage.
 *
 * Answers:
 *   1. AFL Tables AFLM coverage — pages exist back to which year?
 *   2. Does AFL Tables have any AFLW pages?
 *   3. Does AFL Tables have any VFL/VFLW pages?
 *   4. Does vflstats.com.au exist as a current source for VFL/VFLW?
 *
 * Run: bun run scripts/probe-afl-tables.ts
 */

interface ProbeResult {
  url: string;
  status: number | null;
  ok: boolean;
  contentLength?: number | undefined;
  hasMatchData?: boolean | undefined;
  error?: string | undefined;
}

const USER_AGENT =
  "fitzroy-ts/probe (https://github.com/jackemcpherson/fitzRoy-ts; respectful capability check)";

async function probe(url: string, fetchBody = false): Promise<ProbeResult> {
  try {
    const response = await fetch(url, {
      method: fetchBody ? "GET" : "HEAD",
      headers: { "User-Agent": USER_AGENT },
    });
    const len = response.headers.get("content-length");
    const result: ProbeResult = {
      url,
      status: response.status,
      ok: response.ok,
      contentLength: len ? Number(len) : undefined,
    };
    if (fetchBody && response.ok) {
      const html = await response.text();
      // crude heuristic: if the page mentions "Round" and a team name, it has match data
      result.hasMatchData = /Round\s+\d+/i.test(html) && html.length > 5000;
      result.contentLength = html.length;
    }
    return result;
  } catch (e) {
    return { url, status: null, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function header(s: string): void {
  console.log(`\n=== ${s} ===`);
}

function fmtRow(r: ProbeResult): string {
  const status = r.status ?? "ERR";
  const len = r.contentLength != null ? `${r.contentLength}b` : "-";
  const data =
    r.hasMatchData === true ? " [match-data ✓]" : r.hasMatchData === false ? " [no data]" : "";
  return `  ${String(status).padStart(4)}  ${len.padStart(8)}  ${r.url}${data}`;
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// [1] AFL Tables AFLM coverage — sample years across history
// ---------------------------------------------------------------------------
header("[1] AFL Tables AFLM season pages");
const aflmYears = [1897, 1950, 1980, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024, 2025];
for (const year of aflmYears) {
  const r = await probe(`https://afltables.com/afl/seas/${year}.html`);
  console.log(fmtRow(r));
  await delay(500);
}

header("[2] AFL Tables AFLM player stats pages");
for (const year of aflmYears) {
  const r = await probe(`https://afltables.com/afl/stats/${year}s.html`);
  console.log(fmtRow(r));
  await delay(500);
}

// ---------------------------------------------------------------------------
// [3] AFL Tables — does it have AFLW at any URL?
// ---------------------------------------------------------------------------
header("[3] AFL Tables AFLW guesses (probably 404s)");
const aflwUrls = [
  "https://afltables.com/aflw/seas/2017.html",
  "https://afltables.com/aflw/seas/2024.html",
  "https://afltables.com/aflw/aflw.html",
  "https://afltables.com/afl/aflw/2017.html",
  "https://afltables.com/aflw/",
];
for (const url of aflwUrls) {
  console.log(fmtRow(await probe(url)));
  await delay(500);
}

// ---------------------------------------------------------------------------
// [4] AFL Tables — does it have VFL/VFLW at any URL?
// ---------------------------------------------------------------------------
header("[4] AFL Tables VFL/VFLW guesses");
const vflUrls = [
  "https://afltables.com/vfl/seas/2024.html",
  "https://afltables.com/vfl/",
  "https://afltables.com/afl/vfl/2024.html",
  "https://afltables.com/vflw/2024.html",
];
for (const url of vflUrls) {
  console.log(fmtRow(await probe(url)));
  await delay(500);
}

// ---------------------------------------------------------------------------
// [5] vflstats.com.au — does the R package's source exist and respond?
// ---------------------------------------------------------------------------
header("[5] vflstats.com.au probe");
const vflstatsUrls = [
  "https://vflstats.com",
  "https://vflstats.com.au",
  "https://www.vflstats.com",
  "https://www.vflstats.com.au",
];
for (const url of vflstatsUrls) {
  console.log(fmtRow(await probe(url)));
  await delay(500);
}

// ---------------------------------------------------------------------------
// [6] Confirm AFLM 1990 has real data (not just a 200 with empty page)
// ---------------------------------------------------------------------------
header("[6] AFL Tables 1990 data sanity check (GET with body)");
console.log(fmtRow(await probe(`https://afltables.com/afl/seas/1990.html`, true)));
await delay(500);
console.log(fmtRow(await probe(`https://afltables.com/afl/stats/1990s.html`, true)));

console.log("\n=== Probe complete ===");
