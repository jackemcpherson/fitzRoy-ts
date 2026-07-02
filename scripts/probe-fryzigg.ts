/**
 * Fryzigg snapshot probe (Plan 016).
 *
 * Investigates what upstream fryziggafl.net actually offers:
 * - Dump URLs and HTTP metadata (Content-Length, Last-Modified)
 * - Whether a lightweight index/manifest exists
 * - Actual max season present in each dump
 * - Download size and time
 *
 * Run: bun run scripts/probe-fryzigg.ts
 *
 * Security note: fryziggafl.net is HTTP-only (no TLS). This probe
 * is read-only and the data is fed into rds-js.
 */

import { isDataFrame, parseRds } from "@jackemcpherson/rds-js";

const USER_AGENT = "fitzRoy-ts/1.0 probe (https://github.com/jackemcpherson/fitzRoy-ts)";

const DUMP_URLS: Record<string, string> = {
  AFLM: "http://www.fryziggafl.net/static/fryziggafl.rds",
  AFLW: "http://www.fryziggafl.net/static/aflw_player_stats.rds",
};

/**
 * Candidate lightweight index/manifest URLs to probe before downloading the
 * full dump. Fryzigg appears to be a personal static site — no formal API —
 * but it's worth checking common patterns.
 */
const INDEX_CANDIDATES: string[] = [
  "http://www.fryziggafl.net/static/index.json",
  "http://www.fryziggafl.net/static/manifest.json",
  "http://www.fryziggafl.net/",
  "http://www.fryziggafl.net/static/",
];

async function headRequest(url: string): Promise<{
  ok: boolean;
  status: number;
  contentLength: string | null;
  lastModified: string | null;
}> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
    });
    return {
      ok: res.ok,
      status: res.status,
      contentLength: res.headers.get("content-length"),
      lastModified: res.headers.get("last-modified"),
    };
  } catch (_err) {
    return {
      ok: false,
      status: 0,
      contentLength: null,
      lastModified: null,
    };
  }
}

async function probeIndex(): Promise<void> {
  console.log("\n=== Lightweight index/manifest probe ===");
  for (const url of INDEX_CANDIDATES) {
    const head = await headRequest(url);
    const contentType = head.ok ? "(check body)" : "";
    console.log(`  ${head.ok ? "OK  " : "MISS"} ${url}  status=${head.status} ${contentType}`);
  }
}

interface DumpProbeResult {
  readonly competition: string;
  readonly url: string;
  readonly httpStatus: number;
  readonly contentLengthHeader: string | null;
  readonly lastModified: string | null;
  readonly downloadBytes: number;
  readonly downloadMs: number;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly maxDateStr: string | null;
  readonly maxSeason: number | null;
  readonly minDateStr: string | null;
  readonly minSeason: number | null;
  readonly dateColName: string | null;
  readonly error: string | null;
}

async function probeDump(competition: string, url: string): Promise<DumpProbeResult> {
  // First HEAD to get metadata without downloading
  const head = await headRequest(url);

  if (!head.ok) {
    return {
      competition,
      url,
      httpStatus: head.status,
      contentLengthHeader: null,
      lastModified: null,
      downloadBytes: 0,
      downloadMs: 0,
      rowCount: 0,
      columnCount: 0,
      maxDateStr: null,
      maxSeason: null,
      minDateStr: null,
      minSeason: null,
      dateColName: null,
      error: `HEAD request failed with status ${head.status}`,
    };
  }

  // Full GET
  const t0 = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (err) {
    return {
      competition,
      url,
      httpStatus: 0,
      contentLengthHeader: head.contentLength,
      lastModified: head.lastModified,
      downloadBytes: 0,
      downloadMs: Date.now() - t0,
      rowCount: 0,
      columnCount: 0,
      maxDateStr: null,
      maxSeason: null,
      minDateStr: null,
      minSeason: null,
      dateColName: null,
      error: `GET failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!response.ok) {
    return {
      competition,
      url,
      httpStatus: response.status,
      contentLengthHeader: head.contentLength,
      lastModified: head.lastModified,
      downloadBytes: 0,
      downloadMs: Date.now() - t0,
      rowCount: 0,
      columnCount: 0,
      maxDateStr: null,
      maxSeason: null,
      minDateStr: null,
      minSeason: null,
      dateColName: null,
      error: `GET returned ${response.status}`,
    };
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  const downloadMs = Date.now() - t0;
  const downloadBytes = buffer.length;

  // Parse RDS
  let parsed: unknown;
  try {
    parsed = await parseRds(buffer);
  } catch (err) {
    return {
      competition,
      url,
      httpStatus: response.status,
      contentLengthHeader: head.contentLength,
      lastModified: head.lastModified,
      downloadBytes,
      downloadMs,
      rowCount: 0,
      columnCount: 0,
      maxDateStr: null,
      maxSeason: null,
      minDateStr: null,
      minSeason: null,
      dateColName: null,
      error: `RDS parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!isDataFrame(parsed)) {
    return {
      competition,
      url,
      httpStatus: response.status,
      contentLengthHeader: head.contentLength,
      lastModified: head.lastModified,
      downloadBytes,
      downloadMs,
      rowCount: 0,
      columnCount: 0,
      maxDateStr: null,
      maxSeason: null,
      minDateStr: null,
      minSeason: null,
      dateColName: null,
      error: "RDS file did not contain a DataFrame",
    };
  }

  const rowCount = parsed.columns[0]?.length ?? 0;
  const columnCount = parsed.names.length;

  // Find the date column — AFLM uses "match_date", AFLW uses "date"
  const dateColCandidates = ["match_date", "date"];
  let dateColName: string | null = null;
  let dateCol: unknown[] | null = null;

  for (const candidate of dateColCandidates) {
    const idx = parsed.names.indexOf(candidate);
    if (idx !== -1) {
      const col = parsed.columns[idx];
      if (col) {
        dateColName = candidate;
        dateCol = col as unknown[];
        break;
      }
    }
  }

  let maxDateStr: string | null = null;
  let minDateStr: string | null = null;

  if (dateCol) {
    for (const val of dateCol) {
      if (typeof val !== "string") continue;
      if (maxDateStr === null || val > maxDateStr) maxDateStr = val;
      if (minDateStr === null || val < minDateStr) minDateStr = val;
    }
  }

  const maxSeason = maxDateStr ? Number(maxDateStr.slice(0, 4)) : null;
  const minSeason = minDateStr ? Number(minDateStr.slice(0, 4)) : null;

  return {
    competition,
    url,
    httpStatus: response.status,
    contentLengthHeader: head.contentLength,
    lastModified: head.lastModified,
    downloadBytes,
    downloadMs,
    rowCount,
    columnCount,
    maxDateStr,
    maxSeason,
    minDateStr,
    minSeason,
    dateColName,
    error: null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("=== Fryzigg snapshot probe (Plan 016) ===");
console.log(`  Probing at: ${new Date().toISOString()}`);

await probeIndex();

console.log("\n=== Dump probes ===");
for (const [competition, url] of Object.entries(DUMP_URLS)) {
  console.log(`\n-- ${competition} (${url})`);
  const r = await probeDump(competition, url);

  if (r.error) {
    console.log(`  ERROR: ${r.error}`);
    continue;
  }

  const mbDownloaded = (r.downloadBytes / 1_048_576).toFixed(2);
  const headerMb = r.contentLengthHeader
    ? ` (Content-Length header: ${(Number(r.contentLengthHeader) / 1_048_576).toFixed(2)} MB)`
    : " (no Content-Length header)";

  console.log(`  HTTP status:    ${r.httpStatus}`);
  console.log(`  Last-Modified:  ${r.lastModified ?? "(none)"}`);
  console.log(`  Download:       ${mbDownloaded} MB${headerMb}`);
  console.log(`  Download time:  ${r.downloadMs} ms`);
  console.log(`  Rows:           ${r.rowCount.toLocaleString()}`);
  console.log(`  Columns:        ${r.columnCount}`);
  console.log(`  Date column:    ${r.dateColName ?? "(not found)"}`);
  console.log(`  Date range:     ${r.minDateStr ?? "?"} → ${r.maxDateStr ?? "?"}`);
  console.log(`  Season range:   ${r.minSeason ?? "?"} → ${r.maxSeason ?? "?"}`);
}

console.log("\n=== Summary ===");
console.log("  FRYZIGG_LATEST_SNAPSHOT (current hardcoded):  2024");
console.log("  See above for actual max seasons in each dump.");
console.log("\nNote: there is no per-year file scheme or index.");
console.log("      The only way to know the max season is to download and parse the full dump,");
console.log("      or rely on Last-Modified + a maintained constant (Option C / bump ritual).");
