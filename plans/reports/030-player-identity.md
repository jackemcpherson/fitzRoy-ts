# Design Spike 030: Cross-Source Player Identity

**Plan**: `plans/030-player-identity-spike.md`  
**Baseline commit**: `9b1705c`  
**Drift check**: `git diff --stat 9b1705c..HEAD -- src/types.ts src/lib/fuzzy.ts src/transforms/` → no changes  
**Date**: 2026-07-02  

---

## 1. Consumer Algorithm: AFL-MCP Evidence

AFL-MCP (`github.com/jackemcpherson/AFL-MCP`) is the production consumer that surfaces the cost of missing cross-source identity in fitzRoy-ts. Evidence mined from a `--depth 5` clone.

### The root problem

`scripts/dedup-players.ts:1-12`:
> "Players synced from fryzigg (external_id only) and AFL API (external_afl_player_id only) created separate records for the same person."

Each sync path writes to the same DB table but keys on a different ID field (`external_id` for fryzigg, `external_afl_player_id` for AFL API), so a player who appears in both sources gets two rows.

### Matching pipeline

**Step 1 — Adopt (upserts.ts:376-386)**:

On each AFL API player upsert, the consumer tries to adopt an existing fryzigg-only row by exact name match:

```sql
UPDATE players SET external_afl_player_id = ?
WHERE id = (
  SELECT MIN(id) FROM players
  WHERE first_name = ? AND surname = ?
    AND external_afl_player_id IS NULL
    AND external_id IS NOT NULL
)
  AND NOT EXISTS (SELECT 1 FROM players WHERE external_afl_player_id = ?)
```

Key constraint (`upserts.ts:373-374`): `MIN(id)` (adopt at most one row) — updating every name match caused multiple rows to get the same AFL id, violating the unique index. That failure was filed as incident COR-05.

**Step 2 — Dedup pass (dedup-players.ts:78-226)**:

A separate offline script (`scripts/dedup-players.ts`) runs after initial sync to catch pairs the upsert step missed:

1. SQL finds all candidate pairs: one fryzigg-only record + one AFL-only record with exact first+last name match (`dedup-players.ts:80-94`)
2. Groups by `remove_id` and `keep_id` to detect triples (same name, 3+ IDs)
3. Disambiguates triples by team overlap: loads all teams each player appeared for via `player_match_stats`, finds intersection (`dedup-players.ts:154-225`)
4. If the AFL-only record has no stats, falls back to lineup team overlap (`dedup-players.ts:159-179`)
5. Pairs with no team overlap are logged as "skipped" — manual intervention required

**Named homonym (dedup-players.ts:12)**:
> "For triples (common names like Tom Lynch), uses team overlap to disambiguate."

Tom Lynch is the canonical AFL homonym: two distinct players with identical names, overlapping careers (2010–2021 vs 2011–2025), verified by fryzigg data (ids 11872 and 11953 respectively).

### Name-key re-implementation count

Four separate scripts in AFL-MCP re-implement similar name normalization and matching logic:

| Script | Key build function | Notes |
|--------|--------------------|-------|
| `scripts/dedup-players.ts:80-94` | SQL exact match `first_name = ? AND surname = ?` | Dedup pass |
| `src/sync/upserts.ts:376-386` | SQL exact match with `MIN(id)` guard | Live upsert adopt |
| `scripts/backfill-dob.mts:51-53` | `normalizeName(s)` → `toLowerCase().replace(/[^a-z0-9]/g, "")` | DOB backfill |
| `scripts/diagnose-brownlow-gaps.ts:36-37` | `playerKey(matchId, team, first, surname)` | Brownlow gap audit |

### Failure modes documented in consumer

1. **COR-05**: Updating every exact name match gave multiple rows the same AFL id, aborting the transactional batch. Fixed by `MIN(id)` guard — but this silently misassigns for homonyms.
2. **Unresolvable triples**: Pairs where neither stats nor lineup team data overlaps are logged as skipped. No automatic path — maintainer must inspect and patch.
3. **Brownlow gaps**: `diagnose-brownlow-gaps.ts:99-117` shows that after the dedup pass, Brownlow vote attribution still fails for players whose name in fryzigg doesn't exactly match their name in the AFL-API-keyed DB record — a different spelling or hyphenation breaks the `playerKey` lookup.

---

## 2. Collision Measurements

**Method**: One live fryzigg fetch (AFLM competition, full dataset). `FryziggClient.fetchPlayerStats("AFLM")` returns a single column-major DataFrame. Player uniqueness keyed on `player_id` (fryzigg's stable numeric ID). Name collision = two or more distinct `player_id` values share identical `player_first_name` + `player_last_name` (case-insensitive).

**Dataset size**: 685,471 rows, 80 columns.

### Results

| Scope | Unique players | Unique name pairs | Name collisions | Collision rate |
|-------|---------------|-------------------|-----------------|----------------|
| All-time (1897–2025) | 13,272 | 12,732 | 454 | 3.57% |
| 2012–2024 (AFL API era) | 1,725 | 1,719 | 6 | 0.35% |
| 2024 season only | 658 | 658 | 0 | 0.00% |

### 2012–2024 collision cases (complete list)

| Name | Player A | Teams A | Seasons A | Player B | Teams B | Seasons B |
|------|----------|---------|-----------|----------|---------|-----------|
| Scott Thompson | id=11139 | Melbourne, Adelaide | 2001–2017 | id=11642 | North Melbourne | 2008–2019 |
| Tom Lynch | id=11872 | St Kilda, Adelaide | 2010–2021 | id=11953 | Gold Coast, Richmond | 2011–2025 |
| Mitch Brown | id=11991 | Geelong, Essendon | 2011–2022 | id=11548 | West Coast | 2007–2016 |
| Sam Butler | id=11356 | West Coast | 2004–2017 | id=12989 | Hawthorn | 2022–2025 |
| Aaron Black | id=12020 | North Melbourne, Geelong | 2011–2018 | id=12963 | West Coast | 2022–2022 |
| Tom Murphy | id=11464 | Hawthorn, Gold Coast | 2005–2014 | id=12647 | North Melbourne | 2018–2020 |

**Key observation**: All 6 AFL API era collisions are disambiguatable by team — no two players with the same name played for the same team at the same time. Team overlap resolves them without DOB.

**Key observation**: Within a single season, name collisions are zero. The problem only manifests across seasons.

**All-time note**: The 454 historical collisions (1897–2025) skew heavily toward the pre-1940 era when given names like "Bill", "Jack", "Tom" dominated rosters and record-keeping was imprecise. The post-2012 picture (6 cases) is the practical problem scope for this library.

---

## 3. Per-Source Signal Inventory

### Fryzigg (via `src/transforms/fryzigg-player-stats.ts` + live data)

| Signal | Field | Notes |
|--------|-------|-------|
| Stable numeric ID | `player_id` | Unique across all time; no CD_I prefix |
| Given name | `player_first_name` | |
| Surname | `player_last_name` | |
| Height | `player_height_cm` | Present per-row (repeated) |
| Weight | `player_weight_kg` | Present per-row (repeated) |
| Position | `player_position` | Fryzigg label, not AFL API's |
| Jumper number | `guernsey_number` | Per-match; can change between clubs |
| Retirement status | `player_is_retired` | Boolean flag |
| Team (match context) | `player_team` | Team that match was played for, NOT a permanent assignment |
| **DOB** | — | **Not present in fryzigg AFLM dataset** |
| **Draft data** | — | **Not present** |

### AFL API (via `src/lib/validation/afl-api-players.ts`, `test/fixtures/afl-api-squads-carlton-2024.json`)

| Signal | Field | Notes |
|--------|-------|-------|
| Stable Champion Data ID | `providerId` (`CD_I{number}`) | Unique; used downstream as `playerId` |
| Given name | `firstName` / `givenName` | |
| Surname | `surname` | |
| **DOB** | `dateOfBirth` | ISO 8601 (`"YYYY-MM-DD"`); populated in squad endpoint |
| Height | `heightInCm` | Squad endpoint |
| Weight | `weightInKg` | Squad endpoint |
| Draft year | `draftYear` | String in raw API, parsed to number |
| Draft position | `draftPosition` | |
| Draft type | `draftType` | e.g., "National Draft" |
| Debut year | `debutYear` | |
| Recruited from | `recruitedFrom` | Club or state program |
| Jumper number | `jumperNumber` | Per-squad (current season) |
| Position | `position` | e.g., "Midfield" |

Coverage: 2012+ (AFL API era). Squad endpoint needed for bio data (the match stats endpoint only carries `playerId`, `givenName`, `surname`, `playerJumperNumber`).

### AFL Tables (via `src/sources/afl-tables.ts:791-860`)

| Signal | Field | Notes |
|--------|-------|-------|
| Name-derived ID | `AT_{team}_{surname}_{givenName}` | **Not stable** — changes with any spelling variation; breaks on name change |
| Given name | `givenName` | |
| Surname | `surname` | |
| **DOB** | `dateOfBirth` | Raw text string (multiple formats: "DD Mon YYYY"); `backfill-dob.mts` shows 4-format parser needed |
| Height | `heightCm` | Integer cm |
| Weight | `weightKg` | Integer kg |
| Games played | `gamesPlayed` | All-time career count |
| Goals | `goals` | Career total |
| Debut year | `debutYear` | Extracted from "R1 YYYY" text |
| Jumper number | `jumperNumber` | Current (at page-scrape time) |

Coverage: 1897+, per-team pages. No stable opaque ID — the AFL Tables URL key is a name slug.

### Stable signal summary

| Source | Has stable opaque ID? | Has DOB? | ID era |
|--------|----------------------|----------|--------|
| Fryzigg | YES (`player_id` numeric) | NO | 1897+ |
| AFL API | YES (`CD_I{n}` from `providerId`) | YES | 2012+ |
| AFL Tables | NO (name-derived) | YES (text, multi-format) | 1897+ |

For AFL Tables, DOB + height + weight + debut year together serve as the practical composite key for disambiguation. They are not individually unique but the combination eliminates most historical homonyms.

---

## 4. Prior Art: R fitzRoy Ecosystem

Web search found no maintained cross-source player identity mapping table in the R fitzRoy community. The R package (`jimmyday12/fitzRoy`) provides separate per-source fetch functions (`fetch_player_stats_fryzigg()`, `fetch_player_stats_afltables()`, `fetch_player_stats_footywire()`) and has internal helpers for venue name normalization and cross-source name consistency, but these are name-cleaning utilities — not a join key or mapping artifact.

The `jimmyday12/fitzroy_data` companion repository exists but does not appear to publish an `aflApiId ↔ fryziggId` CSV. Community users who need cross-source joining implement their own matching logic, which is described as "fitzRoy's most notorious user pain" in the plan.

**Conclusion**: No existing community artifact changes the calculus. This library would be first-to-market with a cross-source player mapping if it ships one.

---

## 5. Option Analysis

### Option A — Algorithm in the library

**Proposal**: Export `resolvePlayerIdentity(rows: PlayerStats[]) → PlayerCluster[]` — a runtime function that groups rows by identity using name + team-season overlap + DOB where available.

**Assessment**:

For the AFL API era (2012+), the algorithm is straightforward: the 6 collision cases are all disambiguatable by team. A pure algorithm based on `(givenName, surname, team, season)` would resolve all 6 correctly.

However, the AFL-MCP consumer demonstrates the brittleness:
- Name spelling differences between sources (e.g., "McKay" vs "Mackay") require fuzzy matching, which introduces false positives
- The `playerKey(matchId, team, first, surname)` pattern in `diagnose-brownlow-gaps.ts:36-37` still produces misses for name mismatches even after dedup
- DOB is absent from fryzigg entirely, removing the strongest disambiguator
- An algorithm that returns wrong clusters is worse than no algorithm (silent data corruption)
- COR-05 shows that even a simple "update every name match" heuristic caused a real integrity violation

For pre-2012 (454 collisions, many from the same era), an algorithm without DOB has no reliable fallback beyond debut year — and in the pre-1950 era, debut years are sometimes recorded differently across sources.

**Verdict**: Too risky for silent execution. Could be offered as an explicit, opt-in tool with a "candidates only, not resolved" return type — but that's closer to Option C formalized.

### Option B — Published mapping table

**Proposal**: A data artifact (`data/player-map.json`) mapping `aflApiId ↔ fryziggId` for the 2012+ era, committed to the repository and re-generated once per season by `scripts/generate-player-map.ts`. Name+team+DOB fallback documented (not coded) for pre-2012 consumers.

**Assessment**:

The AFL API era mapping is mechanically buildable:
- Fryzigg covers 2012+ with stable `player_id` numeric values
- The AFL API covers 2012+ with stable `CD_I{n}` IDs
- For the 1,725 players in the 2012-2024 overlap, 1,719 are uniquely identifiable by name alone; the 6 collision cases need team-overlap disambiguation — all 6 are resolvable by a human reviewer in under an hour
- Once built, the table is additive: new seasons add new rows; existing rows don't change (IDs are stable)

**Regeneration ritual**:
1. Run `scripts/generate-player-map.ts` (fetches AFL API squads for all 18 AFLM teams for all seasons 2012–present + fryzigg full dataset; joins on exact name; flags collision cases)
2. Human reviews flagged cases (expect 0–2 new ambiguous players per season)
3. Commit `data/player-map.json` with version note in CHANGELOG
4. Add entry to release checklist: "Re-run player map if new season started"

**Scope boundary**:
- Pre-2012: AFL Tables provides DOB for historical disambiguation but AFL Tables IDs are name-derived and unstable. Documenting `playerNameKey()` + DOB matching guidance (Option C) is the honest answer for pre-2012 consumers.
- AFL Tables–to–fryzigg mapping for post-2012 can be derived via the AFL API as intermediary (AFL Tables name → AFL API CD_I → fryzigg player_id) but requires scraping AFL Tables per-team pages and matching names. This is an extension, not the core artifact.

**Maintenance burden**: Low. The script is idempotent; the artifact is small (≈1,700 JSON objects); the human review step is bounded (6 known collision cases already resolved; new ones are rare and typically announced by the AFL when a name clash exists).

**Risk**: If fryzigg or the AFL API retires or changes their ID scheme, the table becomes stale. Both IDs have been stable for 10+ years, but this risk should be noted in a maintenance comment.

### Option C — Primitives only

**Proposal**: Export a documented `playerNameKey(givenName: string, surname: string): string` function (normalized form: lowercase, no punctuation) and matching guidance in the API docs. Consumers own the join policy.

**Assessment**:

This is the current status quo, formalized. It gives consumers a starting point but replicates AFL-MCP's problem: every consumer ends up with their own fragile version of the same algorithm, their own COR-05, their own "4 scripts" proliferation.

However, Option C is the right answer for:
- Pre-2012 era (where building a curated table is too expensive)
- AFL Tables–to–any-source joining (given AFL Tables' unstable IDs)
- Any consumer with unusual policy requirements (e.g., treating homonyms as distinct by default, not merged)

### Option D — Don't

**Assessment**: The consumer evidence argues against D. The problem is real, the AFL API era is solvable, and the failure mode (duplicated maintenance effort across every consumer) is documented. D would be appropriate if the ID schemes were unstable or the sources were unavailable — neither applies for the AFL API era.

---

## 6. Recommendation: B (mapping table) for AFL API era + C (primitives) for pre-2012

### Rationale

- The AFL API era (2012+) has only 6 collision cases. A curated `aflApiId ↔ fryziggId` table is mechanically buildable, human-verifiable in an afternoon, and eliminates the entire duplication problem for the dominant use case.
- The collision data proves that within a single season, name uniqueness is perfect — so any consumer building a single-season analysis needs no cross-source identity at all. The mapping table serves multi-season and career analysis.
- Option A (runtime algorithm) adds complexity and failure modes that the consumer evidence shows are non-trivial. The "adopt at most ONE" guard in AFL-MCP is itself an algorithm that breaks on Tom Lynch without team-overlap disambiguation.
- Pre-2012 is out of scope for a curated mapping in this release. Exporting `playerNameKey()` + documented guidance ("join on name key, verify with DOB and debut year, expect 454 historical collisions") is the honest, bounded commitment.

### Build sketch

**Files**:
- `data/player-map.json` — committed artifact (≈1,700 entries), shape:
  ```ts
  // each entry
  { aflApiId: string; fryziggId: string; displayName: string; debutYear: number | null }[]
  ```
- `scripts/generate-player-map.ts` — generation script (NOT exported from `src/`; runs offline)
- `src/player-map.ts` — typed import + lookup helpers:
  ```ts
  export function lookupFryziggId(aflApiId: string): string | undefined
  export function lookupAflApiId(fryziggId: string): string | undefined
  ```
- `src/index.ts` — re-export the two helpers

**Testing story**:
- One structural test: the artifact has no duplicate `aflApiId` or `fryziggId` values (validated at test time, not runtime)
- One smoke test: `lookupFryziggId("CD_I1000900")` returns a non-empty string (with a fixture entry seeded in the test)
- The generation script is not tested (it's a one-shot offline tool), but its output is the test subject

**Existing `playerId` semantics**: unchanged. The mapping table is purely additive — `Player.playerId` and `PlayerStats.playerId` keep their per-source values. The lookup helpers are a separate, opt-in surface.

**Maintenance notes** (as required by plan):
- The generation script belongs in `scripts/` alongside `dedup-players.ts` and `enrich-fryzigg.ts`
- The release checklist gains: "If a new AFL season has started since the last release, re-run `scripts/generate-player-map.ts`, review any flagged collision cases, and commit the updated `data/player-map.json`"
- If either fryzigg or the AFL API retires their player ID scheme, note in the script header and in `src/player-map.ts` TSDoc

**Effort estimate**: The spike has done the hard analysis. Implementation is S: the generation script is ~150 lines (one fryzigg fetch + per-team AFL API squad fetches + join logic + collision reporter); the library surface (`src/player-map.ts`) is ~30 lines; the static JSON and tests are minimal.

---

## 7. Open Questions

1. **AFLW collision picture**: This analysis covered AFLM only (per plan scope). The AFLW competition is shorter-history but growing; a separate collision analysis would be needed before extending the mapping to AFLW.
2. **Fryzigg ID stability under corrections**: If fryzigg corrects a historical dedup error (e.g., two records found to be the same player), they may merge IDs. The `player_is_retired` flag suggests active metadata — it is unclear if `player_id` is guaranteed immutable.
3. **AFL API CD_I stability**: Champion Data IDs have been stable for the full AFL API era (2012+) based on our data. However, the AFL API is a proprietary endpoint; if Champion Data ever reassigns IDs, the mapping table would need a full rebuild. Low probability but worth a comment in the script.
4. **AFL Tables ↔ fryzigg**: The table proposed here covers AFL API era only. A historical extension (pre-2012 fryzigg ↔ AFL Tables) would require DOB matching on AFL Tables' raw-format dates — the `backfill-dob.mts` in AFL-MCP shows this is doable but multi-format and sanity-check-heavy.

---

## Verification

- [x] Report exists at `plans/reports/030-player-identity.md`
- [x] `npm run test` — 494 tests, all pass, no `src/` changes
- [x] Collision measurements backed by live fryzigg fetch (1 fetch, within budget)
- [x] Consumer algorithm extracted from actual AFL-MCP source with file:line citations
- [x] Prior art web search conducted (3 searches, bounded — no maintained community mapping found)
- [x] Four options assessed honestly; recommendation made with build sketch and maintenance burden
- [x] No `src/` or `test/` files modified
