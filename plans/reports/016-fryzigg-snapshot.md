# Report: Fryzigg Snapshot-Cap Spike (Plan 016)

**Probed at:** 2026-07-02T (UTC)
**Baseline commit:** 05d088c
**Drift check:** clean — no changes to `src/sources/adapters/fryzigg.ts` or `src/sources/fryzigg.ts` since 05d088c

---

## 1. Probe Findings

### 1.1 Upstream URLs

`FryziggClient` fetches two static RDS files:

| Competition | URL |
|-------------|-----|
| AFLM | `http://www.fryziggafl.net/static/fryziggafl.rds` |
| AFLW | `http://www.fryziggafl.net/static/aflw_player_stats.rds` |

Both are plain HTTP (no TLS — previously documented as SEC-10 in the source file).

### 1.2 Lightweight index / manifest

Four candidate paths were probed via HTTP HEAD before downloading anything:

| URL | Result |
|-----|--------|
| `/static/index.json` | 500 |
| `/static/manifest.json` | 500 |
| `/` | 404 |
| `/static/` | 500 |

**There is no index or manifest.** No per-year file naming scheme was found. The 500 responses confirm the host does not serve directory listings. The only way to know the max season precisely is to download and parse the full dump.

### 1.3 Dump metadata and actual max seasons

Probe script: `scripts/probe-fryzigg.ts` (committed alongside this report).

| Metric | AFLM | AFLW |
|--------|------|------|
| HTTP status | 200 | 200 |
| Last-Modified | Mon, 29 Sep 2025 07:06:21 GMT | Mon, 24 Jan 2022 14:57:15 GMT |
| Download size | 11.56 MB | 0.30 MB |
| Download time (observed) | ~4,400 ms | ~380 ms |
| Row count | 685,471 | 9,634 |
| Column count | 80 | 58 |
| Date column | `match_date` | `date` |
| Actual date range | 1897-05-08 → **2025-09-27** | 2017-02-03 → **2022-01-23** |
| **Actual max season** | **2025** | **2022** |

### 1.4 Mismatch with current constant

The hardcoded `FRYZIGG_LATEST_SNAPSHOT = 2024` (shared by both competitions) is wrong in both directions:

- **AFLM is under-capped by 1 year.** The dump contains complete 2025 AFL season data (through 2025-09-27, well past the 2025 Grand Final). Requests for AFLM 2025 currently receive a coverage error directing callers to `--source afl-api`, even though the data exists in the Fryzigg dump.
- **AFLW is over-capped by 2 years.** The AFLW dump was last modified 24 January 2022 and covers data only through 2022-01-23 (the 2022 AFLW season, Round 1). Requests for AFLW 2023 or 2024 pass the coverage check (both ≤ 2024) and incur a 0.30 MB download, but return **zero rows** — exactly the empty/stale-row failure that the cap was designed to prevent (#89).

---

## 2. Option Evaluation

### Option A — Derive at fetch time

After downloading, infer the max season from the dump's date column and return a precise error for queries beyond it.

**Assessment:**

For AFLM, this approach incurs the full 11.56 MB / ~4.4 s download before the "beyond snapshot" determination. The current coverage check runs pre-fetch and synchronously — reversing that ordering would mean every out-of-range AFLM query costs a full download. That is worse than the status quo, not better.

For AFLW, the download is cheap (0.30 MB / ~380 ms), so the cost is lower. But inferring max season from an abandoned dump that returns zero rows for any recent season does not serve the caller — it just tells you after the fact what the coverage check should have caught.

Option A does not improve the user experience versus a corrected static cap, and it introduces coupling between the pre-fetch coverage layer and a post-fetch data artifact.

**Verdict: reject.** The design tension is real: coverage is intentionally synchronous and pre-fetch; auto-detection needs the full dump.

### Option B — Dynamic coverage with cached probe

If a cheap index existed, a lazily-resolved session-cached max season could feed coverage without the full dump cost. But Section 1.2 confirmed there is no index or lightweight endpoint. The only way to probe without a full download is the `Last-Modified` HTTP header — and that tells you when the file last changed, not what season the data covers. Mapping `Last-Modified` to a season year reliably would require either historical knowledge of when each season ends or a download to verify.

Sketching the architecture: `CoverageMap` is currently a static `ReadonlyMap<CompetitionCode, SeasonRange>`. Making `maxSeason` a lazy async value would require changing `checkCoverage`'s signature and every caller — a non-trivial architecture change that touches the dispatch layer (out of scope per the plan). Plan 007/008's sync-vs-async precedent illustrates exactly how much surface a "now async" coverage check would touch.

**Verdict: reject for now.** The absence of a cheap index makes the runtime cost prohibitive. If a lightweight probe ever becomes available, this option can be revisited.

### Option C — Documented bump ritual (chosen)

Keep the static constant(s); document the update process; use `Last-Modified` as a cheap signal during the annual bump check.

**The critical amendment:** the single `FRYZIGG_LATEST_SNAPSHOT = 2024` must become **per-competition constants**, because the two dumps have independent cadences and the shared constant is actively wrong for both at the same time.

Evidence-based caps after this spike:
- `FRYZIGG_AFLM_LATEST_SNAPSHOT = 2025` (probe: dump updated Sep 2025, data through 2025-09-27)
- `FRYZIGG_AFLW_LATEST_SNAPSHOT = 2022` (probe: dump last updated Jan 2022, data through 2022-01-23)

**AFLW coverage note:** The AFLW dump has not been updated in over four years (Last-Modified 24 Jan 2022). This strongly suggests the upstream publisher has abandoned AFLW data. Setting `maxSeason: 2022` means callers requesting AFLW 2023+ get the correct coverage error ("Try: `--source afl-api`") rather than a zero-row download. Whether fryzigg AFLW should eventually be removed from the adapter coverage entirely is a separate decision — for now, capping at 2022 is the honest cap.

**Verdict: chosen.** Zero runtime cost, honest caps, no architecture change.

---

## 3. Implementation (Step 3: trivial, in-scope)

The full implementation of Option C touches only `src/sources/adapters/fryzigg.ts`:

- Replace the shared `FRYZIGG_LATEST_SNAPSHOT = 2024` constant with two per-competition constants: `FRYZIGG_AFLM_LATEST_SNAPSHOT = 2025` and `FRYZIGG_AFLW_LATEST_SNAPSHOT = 2022`.
- Update `FRYZIGG_PLAYER_STATS_COVERAGE` to use the per-competition values.
- Update the comment to document the bump ritual and signal.

This change has been applied in the same commit as this report. See `src/sources/adapters/fryzigg.ts`.

---

## 4. Bump Ritual (process going forward)

**Trigger:** Before each release, as part of the release checklist.

**How to check without downloading:**

```
curl -sI http://www.fryziggafl.net/static/fryziggafl.rds | grep -i last-modified
curl -sI http://www.fryziggafl.net/static/aflw_player_stats.rds | grep -i last-modified
```

A `Last-Modified` date later than the date of the current cap's season Grand Final indicates a new dump is available. Download and run `bun run scripts/probe-fryzigg.ts` to confirm the new max season, then update the constant.

**AFLM cadence:** The dump appears updated annually, near end-of-season (Sep 2025 update corresponds to the 2025 AFL Grand Final). Bump `FRYZIGG_AFLM_LATEST_SNAPSHOT` to the new season year after confirming the probe's `max season` value.

**AFLW:** As of this probe, the AFLW dump has been static since January 2022. If it ever resumes, the same process applies. Until then, `FRYZIGG_AFLW_LATEST_SNAPSHOT = 2022` is correct and should not be bumped.

---

## 5. ADR sketch

**Decision:** Fryzigg coverage caps are per-competition static constants, bumped manually after each season via a documented ritual (Last-Modified check → probe → constant update).

**Context:** No index endpoint exists; the only way to detect a new season is to download the full dump. Async coverage detection would require changing the synchronous `CoverageMap` contract and every caller. The two Fryzigg dumps have independent cadences and must not share a single cap.

**Why not B:** No cheap probe endpoint; dynamic coverage would require a dispatch-layer architecture change (out of scope; risky relative to upside).

**Will be re-suggested:** If fryzigg adds a manifest/index, or if the dispatch layer moves to async coverage checks for another reason, Option B becomes viable.

---

## 6. Follow-up plan sketch

No separate follow-up build plan is needed. The trivial fix (split constant, update caps) is implemented here. The one remaining consideration:

**Consolidate the new-season checklist.** The project now has three annual maintenance points that must be updated together:
- Plan 012: round table (coaches-votes finals boundary)
- Plan 013: AFLW season windows
- This plan: Fryzigg snapshot caps

A single "New AFL Season Checklist" section in the README or a `docs/release-checklist.md` would reduce the risk of any one being missed. This is low-priority and can be done as part of any release-prep work.

---

## Appendix: Raw probe output

```
=== Fryzigg snapshot probe (Plan 016) ===
  Probing at: 2026-07-01T22:56:00.881Z

=== Lightweight index/manifest probe ===
  MISS http://www.fryziggafl.net/static/index.json  status=500
  MISS http://www.fryziggafl.net/static/manifest.json  status=500
  MISS http://www.fryziggafl.net/  status=404
  MISS http://www.fryziggafl.net/static/  status=500

=== Dump probes ===

-- AFLM (http://www.fryziggafl.net/static/fryziggafl.rds)
  HTTP status:    200
  Last-Modified:  Mon, 29 Sep 2025 07:06:21 GMT
  Download:       11.56 MB (Content-Length header: 11.56 MB)
  Download time:  4372 ms
  Rows:           685,471
  Columns:        80
  Date column:    match_date
  Date range:     1897-05-08 → 2025-09-27
  Season range:   1897 → 2025

-- AFLW (http://www.fryziggafl.net/static/aflw_player_stats.rds)
  HTTP status:    200
  Last-Modified:  Mon, 24 Jan 2022 14:57:15 GMT
  Download:       0.30 MB (Content-Length header: 0.30 MB)
  Download time:  376 ms
  Rows:           9,634
  Columns:        58
  Date column:    date
  Date range:     2017-02-03 → 2022-01-23
  Season range:   2017 → 2022
```
