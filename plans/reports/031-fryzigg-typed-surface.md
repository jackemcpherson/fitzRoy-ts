# Design Spike 031: Complete the Typed Fryzigg Surface

**Plan**: `plans/031-fryzigg-typed-surface-spike.md`
**Baseline commit**: `9b1705c`
**Drift check**: `git diff --stat 9b1705c..HEAD -- src/sources/fryzigg.ts src/transforms/fryzigg-player-stats.ts src/sources/adapters/fryzigg.ts` → no changes (clean)
**Date**: 2026-07-02

---

## 0. Source-file state (as found)

| File | Return type of `fetchPlayerStats` |
|------|----------------------------------|
| `src/sources/fryzigg.ts` | `Promise<Result<DataFrame, ScrapeError>>` — raw columnar RDS object from `@jackemcpherson/rds-js`; no Zod, no domain typing at this layer |
| `src/transforms/fryzigg-player-stats.ts` | `Result<PlayerStats[], ScrapeError>` — transforms the raw DataFrame using 63 AFLM column accessors defined in `ResolvedColumns` (lines 93–159) |
| `src/sources/adapters/fryzigg.ts` | `Promise<Result<SeasonPlayerStats, Error>>` — adapts the transform for AFLM (2012–2025) and AFLW (2017–2022, frozen) |

---

## 1. Full Column Inventory

### Method

Live fetches via `scripts/probe-fryzigg-columns.ts` (added to this worktree):
- AFLM: 11.56 MB download, 685,471 rows × 80 columns
- AFLW: 0.30 MB download, 9,634 rows × 58 columns

Classification scheme:
- **A-typed** — already consumed by the typed transform (in `ResolvedColumns` and emitted onto `PlayerStats`)
- **B-match-context** — match-level columns not yet typed (scores, weather, venue, time, attendance)
- **C-player-bio** — player biography columns (height, weight, retirement flag)
- **D-id-joinkey** — raw ID/key columns
- **E-other** — columns that don't fit the above cleanly

> **Probe note**: The AFLW classification was applied conservatively — columns starting with `match_` were automatically classified B-match-context, but AFLW uses unprefixed names (`away_behinds`, `home_goals`, etc.). The E-other AFLW entries below are all match-level results; they are reclassified in the summary.

---

### AFLM Column Inventory (80 columns, 685,471 rows)

#### A-typed — 63 columns (already in `PlayerStats`)

| Column | Type | Null% | Notes |
|--------|------|-------|-------|
| `afl_fantasy_score` | number\|null | 75.3% | → `dreamTeamPoints` |
| `behinds` | number\|null | 36.3% | |
| `bounces` | number\|null | 36.3% | |
| `brownlow_votes` | number\|null | 36.3% | → `brownlowVotes` |
| `centre_clearances` | number\|null | 81.2% | |
| `clangers` | number\|null | 36.3% | |
| `clearances` | number\|null | 36.3% | → `totalClearances` |
| `contest_def_losses` | number\|null | 81.3% | |
| `contest_def_one_on_ones` | number\|null | 81.3% | |
| `contest_off_one_on_ones` | number\|null | 81.3% | |
| `contest_off_wins` | number\|null | 81.3% | |
| `contested_marks` | number\|null | 36.3% | |
| `contested_possessions` | number\|null | 36.3% | |
| `def_half_pressure_acts` | number\|null | 81.3% | |
| `disposal_efficiency_percentage` | number\|null | 81.2% | |
| `disposals` | number\|null | 36.3% | |
| `effective_disposals` | number\|null | 81.3% | |
| `effective_kicks` | number\|null | 81.3% | |
| `f50_ground_ball_gets` | number\|null | 81.3% | |
| `free_kicks_against` | number\|null | 36.3% | |
| `free_kicks_for` | number\|null | 36.3% | |
| `goal_assists` | number\|null | 36.3% | |
| `goals` | number | 0.0% | |
| `ground_ball_gets` | number\|null | 81.3% | |
| `guernsey_number` | number | 0.0% | → `jumperNumber` |
| `handballs` | number\|null | 36.3% | |
| `hitout_win_percentage` | number\|null | 0.0% | NaN values present |
| `hitouts` | number\|null | 36.3% | |
| `hitouts_to_advantage` | number\|null | 81.3% | |
| `inside_fifties` | number\|null | 36.3% | → `inside50s` |
| `intercept_marks` | number\|null | 81.3% | |
| `intercepts` | number\|null | 81.2% | |
| `kicks` | number\|null | 36.3% | |
| `marks` | number\|null | 36.3% | |
| `marks_inside_fifty` | number\|null | 36.3% | |
| `marks_on_lead` | number\|null | 81.3% | |
| `match_away_team` | string | 0.0% | → `awayTeam` |
| `match_date` | string | 0.0% | → `date` (YYYY-MM-DD) |
| `match_home_team` | string | 0.0% | → `homeTeam` |
| `match_id` | number | 0.0% | → `matchId` (as string) |
| `match_round` | string | 0.0% | → `roundNumber` |
| `metres_gained` | number\|null | 81.2% | |
| `one_percenters` | number\|null | 36.3% | |
| `player_first_name` | string | 0.0% | |
| `player_id` | number | 0.0% | fryzigg numeric player ID |
| `player_last_name` | string | 0.0% | |
| `player_position` | string\|null | 68.8% | |
| `player_team` | string | 0.0% | |
| `pressure_acts` | number\|null | 81.3% | |
| `rating_points` | number\|null | 0.0% | NaN values present |
| `rebounds` | number\|null | 36.3% | → `rebound50s` |
| `ruck_contests` | number\|null | 81.3% | |
| `score_involvements` | number\|null | 81.2% | |
| `score_launches` | number\|null | 81.3% | |
| `shots_at_goal` | number\|null | 81.2% | |
| `spoils` | number\|null | 81.3% | |
| `stoppage_clearances` | number\|null | 81.2% | |
| `supercoach_score` | number\|null | 83.4% | → `supercoachScore` |
| `tackles` | number\|null | 36.3% | |
| `tackles_inside_fifty` | number\|null | 81.2% | |
| `time_on_ground_percentage` | number\|null | 36.3% | |
| `turnovers` | number\|null | 81.2% | |
| `uncontested_possessions` | number\|null | 36.3% | |

#### B-match-context — 13 columns (not yet typed)

| Column | Type | Null% | AFL-MCP | Notes |
|--------|------|-------|---------|-------|
| `match_attendance` | number | 0.0% | — | crowd count |
| `match_away_team_behinds` | number | 0.0% | — | |
| `match_away_team_goals` | number | 0.0% | — | |
| `match_away_team_score` | number | 0.0% | — | |
| `match_home_team_behinds` | number | 0.0% | — | |
| `match_home_team_goals` | number | 0.0% | — | |
| `match_home_team_score` | number | 0.0% | — | |
| `match_local_time` | string | 0.0% | **yes** | sample: "15:00:00" |
| `match_margin` | number | 0.0% | — | |
| `match_weather_temp_c` | number\|null | 78.8% | **yes** | 78.8% null (mostly pre-2010) |
| `match_weather_type` | string\|null | 78.8% | **yes** | e.g., "CLEAR\_NIGHT" |
| `match_winner` | string | 0.0% | — | |
| `venue_name` | string | 0.0% | — | |

#### C-player-bio — 3 columns

| Column | Type | Null% | Notes |
|--------|------|-------|-------|
| `player_height_cm` | number\|null | 84.1% | repeated per row (not per player); very patchy |
| `player_is_retired` | boolean\|null | 2.3% | sample: `true` |
| `player_weight_kg` | number\|null | 84.1% | repeated per row; very patchy |

#### E-other — 1 column

| Column | Type | Null% | Notes |
|--------|------|-------|-------|
| `subbed` | string\|null | 8.1% | substitution status; sample: "Not Subbed"; likely values: "On", "Off", "Not Subbed" |

---

### AFLW Column Inventory (58 columns, 9,634 rows)

#### A-typed — 43 columns (already in `PlayerStats`)

All 43 are carried through the typed transform. AFLW column names differ from AFLM (see `AFLW_COLUMNS` mapping in the transform): `date`, `home_team`, `away_team`, `team`, `fixture_round`, `number` (jumper), `player_name` (split on ", "), `frees_for`, `frees_against`, `total_clearances`, `inside50s`, `rebound50s`, `disposal_efficiency`, `marks_inside50`, `tackles_inside50`, `time_on_ground`, `position`, `fantasy_score`, `total_possessions`, plus the shared stat columns. All have 0.0% null (AFLW is a short, more complete dataset).

#### B-match-context — 14 columns (5 probe-classified + 9 probe-misclassified as E-other)

> Probe classified these using the `^match_` prefix pattern which doesn't apply to AFLW naming. Corrected below.

| Column | Type | Null% | Notes |
|--------|------|-------|-------|
| `local_time` | string | 0.0% | equivalent of AFLM `match_local_time` |
| `venue` | string | 0.0% | equivalent of AFLM `venue_name` |
| `weather_description` | string | 0.0% | free-text; absent in AFLM |
| `weather_temp_c` | number | 0.0% | equivalent of AFLM `match_weather_temp_c` (0% null in AFLW) |
| `weather_type` | string | 0.0% | equivalent of AFLM `match_weather_type` |
| `away_behinds` | number | 0.0% | AFLM equiv: `match_away_team_behinds` |
| `away_goals` | number | 0.0% | AFLM equiv: `match_away_team_goals` |
| `away_score` | number | 0.0% | AFLM equiv: `match_away_team_score` |
| `finals_match` | string | 0.0% | "False"/"True"; absent in AFLM |
| `home_behinds` | number | 0.0% | |
| `home_goals` | number | 0.0% | |
| `home_score` | number | 0.0% | |
| `margin` | number | 0.0% | AFLM equiv: `match_margin` |
| `winner` | string | 0.0% | AFLM equiv: `match_winner` |

#### D-id-joinkey — 1 column

| Column | Type | Null% | Notes |
|--------|------|-------|-------|
| `id` | number | 0.0% | sample: 27; appears to be an internal AFLW row/record ID separate from `match_id` |

---

### Summary: counts per classification

| Class | AFLM | AFLW (corrected) | Description |
|-------|------|------------------|-------------|
| A-typed | 63 | 43 | Consumed by `transformFryziggPlayerStats` → `PlayerStats` |
| B-match-context | 13 | 14 | Match-level data not in `PlayerStats` |
| C-player-bio | 3 | 0 | Bio data repeated per row |
| D-id-joinkey | 0 | 1 | Raw ID columns |
| E-other | 1 | 0 | `subbed` (player substitution flag) |
| **Total** | **80** | **58** | |

---

## 2. Design Recommendations

### 2a. Match-context columns → `FryziggMatchContext`

**Gap**: 13 AFLM columns (weather, scores, venue, attendance, local time) and 14 AFLW columns are match-level and not part of `PlayerStats`. AFL-MCP accesses three of these directly from the raw DataFrame: `match_weather_temp_c`, `match_weather_type`, `match_local_time`.

**Recommended shape**: A new `FryziggMatchContext` type returned by a companion method, NOT attached per-row.

Rationale: These are match-level facts — one value per match, not per player. Repeating them on every `PlayerStats` row (as the raw dump does) is correct for a columnar format but wrong for a typed domain model. A separate, match-keyed structure matches the semantics and avoids duplicating 30+ rows of identical data.

```ts
/** Match-level context published by fryzigg alongside per-player stats. */
export interface FryziggMatchContext {
  /** Fryzigg's internal sequential match ID (not the AFL API matchId). */
  readonly fryziggMatchId: number;
  /** ISO date string YYYY-MM-DD. */
  readonly matchDate: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly homeGoals: number;
  readonly homeBehinds: number;
  readonly homeScore: number;
  readonly awayGoals: number;
  readonly awayBehinds: number;
  readonly awayScore: number;
  readonly margin: number;
  readonly winner: string;
  /** Crowd attendance. Present in AFLM only. */
  readonly attendance: number | null;
  readonly venueName: string;
  /** Local start time as "HH:MM:SS". */
  readonly localTime: string;
  /** Temperature in Celsius. ~78.8% null in AFLM pre-2010; 0% null in AFLW. */
  readonly weatherTempC: number | null;
  /** E.g., "CLEAR_NIGHT", "RAIN". ~78.8% null in AFLM pre-2010; 0% null in AFLW. */
  readonly weatherType: string | null;
  /** Free-text weather description. AFLW only. */
  readonly weatherDescription: string | null;
  /** Whether this was a finals match. AFLW only. */
  readonly isFinalsMatch: boolean | null;
}
```

**Delivery surface**: New method on `FryziggClient`:
```ts
async fetchMatchContext(competition: CompetitionCode): Promise<Result<FryziggMatchContext[], ScrapeError>>
```
This shares the existing single download — `fetchPlayerStats` + `fetchMatchContext` on the same `FryziggClient` instance should reuse a cached buffer. Because both pull from the same RDS dump, a simple per-instance LRU cache (or expose a `fetchRaw(competition)` internal method called by both) avoids two full downloads.

**What this deletes from AFL-MCP**: All of `enrich-fryzigg.ts` lines 166–175 direct DataFrame accessors for weather/time, plus the `matchSets` construction block at lines 236–258. The consumer would call `fetchMatchContext("AFLM")` and iterate typed objects instead.

---

### 2b. Join key → composite date+teams helper

**Finding**: Fryzigg's `match_id` is a fryzigg-internal sequential integer (sample: 1 for the first 1897 AFLM match; 35 for the first 2017 AFLW match). AFLM has 16,838 unique match IDs. The AFL API uses string format `CD_M{number}` (Champion Data IDs). These two ID spaces are entirely separate with no documented mapping. A direct join is not possible.

**AFL-MCP's current approach** (`enrich-fryzigg.ts:149, 206–207`):
```ts
const matchKey = `${datePart}|${homeTeamId}|${awayTeamId}`;
```
Where `homeTeamId` and `awayTeamId` are AFL-MCP's internal DB integers (not the team names). The consumer maps fryzigg team names through an inline 20-entry `FRYZIGG_TEAM_MAP` (lines 47–81) before looking up its DB IDs.

**Recommended approach**: Expose a pair of typed key helpers so no consumer hand-builds this again:

```ts
/**
 * Build a normalised match key from a fryzigg match-context row.
 * The key is stable for use as a join key against AFL API match results.
 *
 * @example
 * const key = fryziggMatchKey(ctx);  // "2024-08-03|Hawthorn|Melbourne"
 */
export function fryziggMatchKey(ctx: {
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
}): string {
  return `${ctx.matchDate.slice(0, 10)}|${normaliseTeamName(ctx.homeTeam)}|${normaliseTeamName(ctx.awayTeam)}`;
}

/**
 * Build a normalised match key from an AFL API MatchResult.
 * Pair with fryziggMatchKey to join fryzigg context to AFL API data.
 */
export function aflMatchKey(match: {
  date: Date | null;
  homeTeam: string | null;
  awayTeam: string | null;
}): string | null {
  if (!match.date || !match.homeTeam || !match.awayTeam) return null;
  const d = match.date.toISOString().slice(0, 10);
  return `${d}|${match.homeTeam}|${match.awayTeam}`;
}
```

Export both from `src/index.ts`. These are pure functions — no network, no state — so they require no fixtures beyond unit tests.

**Cross-reference to plan 030**: Plan 030 recommends a curated `aflApiId ↔ fryziggId` mapping table (`data/player-map.json`) generated once per season. The fryzigg `player_id` inventory feeds that table:
- AFLM: stable numeric IDs (1897–present). Sample `player_id` = 1 for the first recorded player.
- AFLW: separate numeric namespace (sample `player_id` = 21 for the first AFLW record).
- Neither namespace has any relationship to AFL API `CD_I{n}` IDs.

The match key helpers here are complementary to the player mapping table: they solve the match join (one table per match), while plan 030's artifact solves the player join (one row per player, keyed on `aflApiId ↔ fryziggId`).

---

### 2c. DOB / biography verdict

**Finding**: No DOB column exists in either the AFLM or AFLW fryzigg dump. The probe script searched for any column matching `/dob|birth/i` — none found.

AFL-MCP's `backfill-dob.mts:133–135` (`findDobColumn`) returns null for the fryzigg frame; the script logs "No DOB-ish column found — Stage 1 (fryzigg) unavailable, use --stage afltables" and falls back to AFL Tables. This confirms the probe result.

**Bio columns present**:
- `player_height_cm`: 84.1% null (only post-2012 matches have it, and even then it is sparse)
- `player_weight_kg`: 84.1% null (same pattern)
- `player_is_retired`: 2.3% null; boolean flag — only value for biography

**Verdict**: Do not expose `player_height_cm` or `player_weight_kg` on `PlayerStats` (too patchy; the bio data the AFL API provides via squad endpoint is more complete and attached to the right entity — the player record, not the per-game stats row). The `player_is_retired` flag has value as metadata but belongs in a player biography type (plan 030's player mapping artifact), not in per-game stats.

**DOB route for consumers**: AFL Tables remains the only source of DOB for historical research. The plan 030 recommendation (curated `aflApiId ↔ fryziggId` table) connects fryzigg `player_id` to AFL API `CD_I{n}`, which in turn connects to the AFL API squad endpoint's `dateOfBirth` field. That chain is the correct design path, not trying to extract DOB from fryzigg.

---

### 2d. FryziggClient public surface

**Current state**: `FryziggClient.fetchPlayerStats(competition)` is public, returns `Result<DataFrame, ScrapeError>`. This is the escape hatch AFL-MCP uses to access match-context columns.

**Recommendation**: Keep the raw DataFrame method public (documented as `@advanced`), add the typed surface alongside it, then once the typed surface covers all AFL-MCP columns, mark the raw DataFrame method `@deprecated`.

Concretely:
1. Add `FryziggClient.fetchMatchContext(competition)` returning `Result<FryziggMatchContext[], ScrapeError>` — this closes the weather/time/venue gap for AFL-MCP.
2. The typed player stats path (`fetchPlayerStats` → `transformFryziggPlayerStats`) already covers brownlow and supercoach since v3. AFL-MCP is pinned at 3.0.1 and unaware of this.
3. `player_is_retired` and the bio columns: document as inaccessible without the raw DataFrame (intentionally excluded from typed surface due to 84.1% null rate).
4. `subbed` column: document as accessible only via raw DataFrame for now; low priority given its absence from AFL-MCP's workflow.

**What this deletes from AFL-MCP once implemented**:
- `scripts/enrich-fryzigg.ts`: the entire raw DataFrame column-accessor block (lines 165–175) and match-context enrichment section (lines 235–260). Player stats enrichment (brownlow/supercoach) would use `fetchPlayerStats` from the public API.
- The inline `FRYZIGG_TEAM_MAP` (lines 47–81) becomes unnecessary once `normaliseTeamName` (already exported from fitzRoy-ts) is used directly by the typed helpers.

---

## 3. Build Sketch

### Files

| File | Action | Effort |
|------|--------|--------|
| `src/types.ts` | Add `FryziggMatchContext` interface | XS |
| `src/transforms/fryzigg-match-context.ts` | New pure transform: DataFrame → `FryziggMatchContext[]` (shares column-resolution pattern with `fryzigg-player-stats.ts`) | S |
| `src/sources/fryzigg.ts` | Add `fetchMatchContext(competition)` method; add internal `fetchRaw` cache to avoid double downloads | S |
| `src/lib/fryzigg-keys.ts` | `fryziggMatchKey()` and `aflMatchKey()` pure functions | XS |
| `src/index.ts` | Re-export `FryziggMatchContext`, `fryziggMatchKey`, `aflMatchKey` | XS |
| `test/transforms/fryzigg-match-context.test.ts` | Transform tests using a columnar fixture (extend or copy AFLM fixture) | S |
| `test/lib/fryzigg-keys.test.ts` | Unit tests for the two key helpers | XS |
| `test/fixtures/fryzigg-aflm-match-context.json` | Minimal fixture: 2 matches × ~3 players, containing all B-class columns | XS |

**Total estimated effort**: S (1–3 days implementation + review). The pattern is established — `fryzigg-player-stats.ts` already shows the column-resolution and row-mapping approach. The match-context transform is simpler (one row per match, not per player).

### Fixture strategy

Columnar fixtures already exist under `test/fixtures/`. The new match-context fixture should be a minimal columnar structure (same shape as what `parseRds` returns but as a plain JSON `{ names: string[], columns: unknown[][] }`) with 2 match entries × 3 player rows each, covering:
- All 13 B-class AFLM columns
- One row with null weather (simulating pre-2010)
- One row with a non-"Not Subbed" value for `subbed`

Do NOT replace existing fixtures — append a new file.

### AFLW coverage note

The AFLW dump is frozen at January 2022 (per adapter comment, confirmed 2026-07-02). `FryziggMatchContext` should cover AFLW too — the 14 AFLW B-class columns map cleanly to the same interface with nullable fields for AFLM-only fields (`attendance`, `isFinalsMatch` flipped: AFLM-only vs AFLW-only for the finals flag). Build a shared interface and resolve column names via the same AFLM/AFLW mapping pattern used in the player-stats transform.

Whether to prioritise AFLW enrichment is a separate decision: the data is fixed, so any consumer using it for historical analysis gets permanent value; the effort is low given the shared implementation. The report does not demote AFLW to "historical only" because "historical" is exactly the use case — AFLW coverage for 2017–2022 is complete and stable.

---

## 4. AFLM vs AFLW Unification

The two dumps are structurally similar enough for a shared implementation with per-competition column mapping (already the pattern in `AFLM_COLUMNS` / `AFLW_COLUMNS`). The differences are:

| Aspect | AFLM | AFLW |
|--------|------|------|
| Match-context column prefix | `match_*` | unprefixed |
| Weather null rate | 78.8% | 0.0% |
| `attendance` column | `match_attendance` | absent |
| `finals_match` flag | absent | `finals_match` ("False"/"True") |
| `weather_description` | absent | present |
| Score columns | `match_home_team_goals` etc. | `home_goals` etc. |
| `id` column | absent | present (internal ID) |

No STOP condition triggered: a single `FryziggMatchContext` interface with nullable fields for competition-specific columns covers both competitions cleanly.

---

## Verification

- [x] Report exists at `plans/reports/031-fryzigg-typed-surface.md`
- [x] `npm run test` — 494 tests, all pass; no `src/` changes
- [x] `npx biome check src/ test/ scripts/` — 6 pre-existing warnings, no errors (same baseline)
- [x] No `src/` or `test/` files modified
- [x] Column inventory backed by live probe fetches (AFLM: 11.56 MB / 685,471 rows; AFLW: 0.30 MB / 9,634 rows)
- [x] AFL-MCP scripts read at stated file:line references (enrich-fryzigg.ts:47–81, 149, 165–175, 206–207, 235–258; backfill-dob.mts:51–53, 133–135)
- [x] DOB verdict backed by live probe (zero columns matching `/dob|birth/i`)
- [x] Join-key verdict backed by live data (match_id sample: 1 for AFLM, 35 for AFLW; AFL API format is `CD_M{n}` — incompatible)
- [x] Drift check: no changes to fryzigg source files since 9b1705c
- [x] No `plans/README.md` update (reviewer maintains the index per executor instructions)
