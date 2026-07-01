# Design Report 025: Computed Team Stats from AFL API PlayerStats

**Plan:** [025-computed-team-stats-spike](../025-computed-team-stats-spike.md)
**Date:** 2026-07-02
**Drift check:** `git diff --stat 05d088c..HEAD -- src/api/team-stats.ts src/api/awards.ts src/transforms/computed-ladder.ts` produced no output — zero drift from baseline.

---

## Executive summary

Computing `TeamStatsEntry[]` from AFL API `PlayerStats` is structurally sound.
`TeamMetricSet` is fully nullable, so a computed adapter can satisfy every field
without a breaking type change. Nineteen of 24 metric keys are directly additive
from per-player rows; the remaining five require explicit handling (three
non-additive rates dropped; two with field-name mismatches). The cost is high for
a season query (~207 network calls for a full AFLM season) but acceptable for a
per-round scope (~9 calls). The design inherits AFL API coverage, including
AFLW/VFL/VFLW, which no existing team-stats source touches. No STOP condition was
triggered by code analysis; a single live spot-check is recommended before
shipping.

---

## Step 1: Current contract and stat-key derivability

### Sources registered for team stats

From `src/sources/adapters/registry.ts` (line 60):
```ts
export const teamStatsRegistry = new CapabilityRegistry<TeamStatsSource>("afl-tables");
```
Default source is `"afl-tables"`. Registered adapters (`src/sources/adapters/index.ts`, lines 73–74):
- `FootyWireTeamStatsSource` — AFLM only, 2010+
- `AflTablesTeamStatsSource` — AFLM only, ~1965+

AFL API has no team-stats adapter in the registry today. `AflApiPlayerStatsSource`
is registered for `playerStatsRegistry`, with coverage `AFLM 2012+, AFLW 2017+,
VFL/VFLW 2021+` (`src/sources/adapters/afl-api.ts`, lines 46–51).

### TeamMetricSet definition (src/types.ts lines 743–768)

Twenty-four nullable fields: kicks, handballs, disposals, marks, goals, behinds,
goalAssists, tackles, hitouts, freesFor, freesAgainst, clearances, clangers,
inside50s, rebound50s, contestedPossessions, uncontestedPossessions, contestedMarks,
marksInside50, onePercenters, bounces, brownlowVotes, fantasyPoints, supercoachPoints.

### Stat-key derivability table

| TeamMetricSet key | AFL Tables | FootyWire | AFL API PlayerStats field | Additive? | Notes |
|---|:---:|:---:|---|:---:|---|
| `kicks` | ✓ | ✓ | `kicks` | Yes | Direct sum |
| `handballs` | ✓ | ✓ | `handballs` | Yes | Direct sum |
| `disposals` | ✓ | ✓ | `disposals` | Yes | Direct sum; also derivable as kicks+handballs |
| `marks` | ✓ | ✓ | `marks` | Yes | Direct sum |
| `goals` | ✓ | ✓ | `goals` | Yes | Direct sum |
| `behinds` | ✓ | ✓ | `behinds` | Yes | Direct sum |
| `goalAssists` | ✓ | ✓ | `goalAssists` | Yes | Null for VFL/VFLW (CONTEXT.md) |
| `tackles` | ✓ | ✓ | `tackles` | Yes | Direct sum |
| `hitouts` | ✓ | ✓ | `hitouts` | Yes | Direct sum |
| `freesFor` | ✓ | ✓ | `freesFor` | Yes* | Minor attribution discrepancy possible (see §3) |
| `freesAgainst` | ✓ | ✓ | `freesAgainst` | Yes* | Minor attribution discrepancy possible (see §3) |
| `clearances` | ✓ | ✓ | `totalClearances` | Yes | Field name differs; also = centreClearances + stoppageClearances |
| `clangers` | ✓ | ✓ | `clangers` | Yes | Null for VFL/VFLW (CONTEXT.md) |
| `inside50s` | ✓ | ✓ | `inside50s` | Yes | Direct sum |
| `rebound50s` | ✓ | ✓ | `rebound50s` | Yes | Direct sum |
| `contestedPossessions` | ✓ | — | `contestedPossessions` | Yes | Direct sum |
| `uncontestedPossessions` | ✓ | — | `uncontestedPossessions` | Yes | Direct sum |
| `contestedMarks` | ✓ | — | `contestedMarks` | Yes | Direct sum |
| `marksInside50` | ✓ | — | `marksInside50` | Yes | Null for VFL/VFLW (CONTEXT.md) |
| `onePercenters` | ✓ | — | `onePercenters` | Yes | Null for VFL/VFLW (CONTEXT.md) |
| `bounces` | ✓ | — | `bounces` | Yes | Null for VFL/VFLW (CONTEXT.md) |
| `brownlowVotes` | ✓ | — | `brownlowVotes` | Yes | Direct sum; typically null mid-season until announced |
| `fantasyPoints` | — | ✓ | `dreamTeamPoints` | Yes* | **Field-name mismatch**: AFL API delivers AFL Fantasy (DreamTeam) scores as `dreamTeamPoints`, not `fantasyPoints`. Additive once mapped. |
| `supercoachPoints` | — | ✓ | `supercoachScore` | n/a | **Always null for AFL API**: `src/transforms/player-stats.ts` line 101 hardcodes `supercoachScore: null` — the AFL API does not provide Supercoach data. Computed rows will always have `supercoachPoints: null`. |

**Non-additive fields in PlayerStats with no TeamMetricSet equivalent:**
`disposalEfficiency`, `goalAccuracy`, `kickToHandballRatio`, `timeOnGroundPercentage`,
`hitoutWinPercentage`, `hitoutToAdvantageRate`, `contestedPossessionRate`,
`contestOffWinsPercentage`, `contestDefLossPercentage` — these are ratios and
percentages; they do not sum to a meaningful team total and are correctly absent
from `TeamMetricSet`.

### Key name mapping required

Two fields need explicit aliasing in the transform (not found by exact-name search):

| PlayerStats field | TeamMetricSet field | Reason |
|---|---|---|
| `totalClearances` | `clearances` | AFL API stores clearances in a nested `clearances` sub-object; `totalClearances` is the flat value |
| `dreamTeamPoints` | `fantasyPoints` | Historical naming: "DreamTeam" became "AFL Fantasy"; AFL API kept the old field name |

---

## Step 2: Computed source design

### ADR-0001 compliance

The proposed adapter is **not** cross-source fallback. ADR-0001 prohibits silently
routing to a different source when the requested source lacks coverage. This design
adds a new capability (team-level aggregation) **within** the AFL API source
boundary, using data the AFL API already serves. The `source` field on each
`TeamStatsEntry` row remains `"afl-api"`. No other source is consulted.

The closest precedent is `AflTablesLadderSource` (`src/sources/adapters/afl-tables.ts`,
lines 198–230): AFL Tables doesn't have a ladder endpoint, so the adapter computes
it from match results, stamps `source: "afl-tables"`, and registers in the ladder
registry. The computed team-stats adapter follows the identical pattern.

### Envelope vs per-row rule

Derived from the code, not from a written document:

- `SeasonPlayerStats` uses an **envelope** `{ stats, failedMatchIds }` because the
  season scrape is a multi-step fan-out where individual match failures must not
  abort the whole response. The envelope carries partial-failure state.
- `Ladder` carries a top-level `source: DataSource` field; individual `LadderEntry`
  objects have no `source` field.
- `TeamStatsEntry` already carries a **per-row** `source: DataSource` field (types.ts
  line 783). There is one entry per team per season; each row is independently
  attributable to its producing source.

Conclusion: computed team stats falls on the **per-row** side. Each `TeamStatsEntry`
is stamped `source: "afl-api"`. No envelope is needed because the AFL API
PlayerStats adapter already handles the fan-out semantics (fail-fast for AFL API;
the computed adapter inherits that failure mode from the underlying PlayerStats fetch).

### Aggregation algorithm

The core transform is a two-pass accumulation over `PlayerStats[]`:

```
function computeTeamStats(rows: PlayerStats[], season, competition): TeamStatsEntry[]
  forMap  = Map<team, MutableMetricAccumulator>
  againstMap = Map<opponent, MutableMetricAccumulator>

  for each row:
    team     = row.team
    opponent = row.homeTeam === row.team ? row.awayTeam : row.homeTeam
    // skip rows where homeTeam/awayTeam is null (single-match query without context)
    if opponent is null: accumulate only forMap

    addToAccumulator(forMap, team, row)
    if opponent: addToAccumulator(againstMap, opponent, row)

  return mergeToEntries(forMap, againstMap, season, competition, "afl-api")
```

The accumulator tracks a `hasValue` flag per metric key alongside the running sum.
`addToAccumulator` adds non-null values and sets `hasValue = true`. On flush,
metrics where `hasValue` is still false emit `null`, not `0`. This satisfies the
CONTEXT.md VFL/VFLW rule: "a computed team stat over a null field must be null,
not 0."

### Null propagation detail

CONTEXT.md states the 10 AFL API VFL/VFLW null fields:
`bounces, totalPossessions, marksInside50, onePercenters, clangers, goalAssists,
goalAccuracy, turnovers, shotsAtGoal, metresGained`.

Of these, five appear in `TeamMetricSet`: `bounces`, `marksInside50`,
`onePercenters`, `clangers`, `goalAssists`. All five will be `null` in computed
VFL/VFLW rows — correctly, since no player in the underlying data has a non-null
value for them.

The five that do NOT appear in `TeamMetricSet` (`totalPossessions`, `goalAccuracy`,
`turnovers`, `shotsAtGoal`, `metresGained`) are simply not produced, so their null
status is irrelevant to the output type.

### summaryType = "averages"

The existing `AflTablesTeamStatsSource` implements averages by post-processing
totals (`averageMetrics`, afl-tables.ts lines 120–133). The computed adapter should
do the same: compute totals first, then divide by `gamesPlayed` when
`summaryType === "averages"`. The `gamesPlayed` denominator is the count of distinct
`matchId` values seen for a team in the PlayerStats input.

### Provenance on partial seasons

For a per-round query (the recommended MVP scope), `homeTeam`/`awayTeam` context
is always available on AFL API PlayerStats rows when fetched via the season path.
For a single-match query (`query.matchId`), the rows also carry context (the
adapter populates `homeTeam`/`awayTeam` in both code paths — `src/sources/adapters/afl-api.ts`
lines 95–96 and 150–153). The `against` side is therefore computable in all query
modes.

### Query cost estimate

**Season query (e.g. AFLM 2024):**
- `resolveCompSeason`: 1 call
- `fetchSeasonMatchItems`: 1 call (returns ~207 match items for a full season: 9 games × 23 H&A rounds + ~16 finals)
- `batchedMap(matchItems, fetchPlayerStats, { batchSize: 5, delayMs: 0 })`: ceil(207 / 5) = 42 sequential batches of 5 parallel calls
- Total: ~44 calls. At 200–400 ms per batch: **~9–17 seconds wall time**

**Per-round query (e.g. any round of AFLM 2024):**
- `resolveCompSeason`: 1 call
- `fetchRoundMatchItemsByNumber`: 1 call (returns 9 match items)
- `batchedMap` of 9 items: ceil(9 / 5) = 2 batches
- Total: ~4 calls, **~500 ms extra** over a match-listing query

**AFLM historical season (e.g. 2012, first AFL API year):**
- Same profile as above, capped at ~23 rounds × 9 games = 207 games.

**AFLW season (e.g. 2024):**
- Shorter season: ~14 rounds × 9 games = 126 games → ceil(126 / 5) = 26 batches
- Total: **~28 calls, ~6–12 seconds**

**VFL/VFLW:**
- Similar to AFLW; plus VFL/VFLW PlayerStats are partial (null advanced fields),
  so the computed team stats will reflect those nulls.

**Assessment:** Season queries are expensive relative to the scraper sources (which
return pre-aggregated data in 1–2 HTTP requests). A per-round scope is the honest
MVP: it makes the feature useful for recent-round lookups without the full-season
latency cost. Season queries should be documented as slow and potentially subject
to a future caching layer.

### Coverage map

```ts
const AFL_API_TEAM_STATS_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 2012 }],
  ["AFLW", { minSeason: 2017 }],
  ["VFL",  { minSeason: 2021 }],
  ["VFLW", { minSeason: 2021 }],
]);
```

This is identical to `AFL_API_COVERAGE` used by the other AFL API adapters. It
represents a genuine expansion: AFLW/VFL/VFLW team stats from a single source for
the first time.

---

## Step 3: Open questions and build sketch

### Open questions (maintainer decisions)

**1. Is a computed default acceptable where scrapers return measured totals?**

The main risk area is `freesFor`/`freesAgainst` and `clearances`. In AFL, these
stats can differ between summed-player and official-team values due to umpiring
attribution rules (e.g., a team free kick not assigned to a specific player). For
major counting stats (kicks, marks, handballs, goals, behinds, tackles, hitouts)
the sum of player rows should exactly equal the team total — this is how AFL Stats
defines those fields.

A one-match live spot-check is required before shipping: fetch PlayerStats for one
match via `afl-api`, sum by team, and compare against AFL Tables or FootyWire team
stats for the same match. If the delta on freesFor/freesAgainst and clearances is
consistently 0 or 1 across a sample of matches, the approach is clean. If it is
larger, the report should be updated and those fields should emit `null` rather than
a potentially incorrect sum. **This verification is the primary pre-ship gate.**

**2. Should `teamStatsRegistry.defaultSource` change from `"afl-tables"` to `"afl-api"`?**

The most obvious improvement: make team stats work without `--source` for any supported
competition. However, changing the default changes behavior for existing AFLM users
who currently get AFL Tables data (which includes `brownlowVotes` at the team level
and covers AFLM back to 1965). The AFL API default would give AFLM only from 2012
and would always have `supercoachPoints: null`.

Safer approach: register `AflApiTeamStatsSource` in the registry but keep the
default as `"afl-tables"`. Document that `--source afl-api` unlocks AFLW/VFL/VFLW
team stats. Revisit the default only after the spot-check passes and user feedback
confirms the field differences are acceptable.

**3. Should the CLI hint when serving computed rows?**

The existing computed patterns do not hint. Coleman awards (`fetchAwards` with
`award: "coleman"`) returns `source: "afl-api"` per row with no extra annotation.
The computed ladder (`AflTablesLadderSource`) carries no "synthesised" flag on
`Ladder`. Consistency suggests no hint is needed; the per-row `source: "afl-api"`
field is the provenance record. A verbose CLI output could note "computed from
PlayerStats" if the `--verbose` flag is added in a future pass.

**4. Fail-fast inheritance for season queries**

`AflApiPlayerStatsSource` is fail-fast: any per-match failure returns an `err`
Result, leaving `failedMatchIds` always empty on success. The computed team stats
adapter inherits this: one bad match aborts the season query. For scrapers this
would be unacceptable (scrapes fail routinely), but the AFL API is a structured
endpoint where per-match failure indicates a genuine problem — the fail-fast
behavior is intentional (ADR-0003).

The open question: for a partial-season snapshot (mid-season, where some rounds
have not yet been played), the pending matches will have no stats. The
`AflApiPlayerStatsSource` must filter to completed matches before calling
`fetchPlayerStats` per match — verify the existing adapter already handles this
(check `includeUpcoming` logic, afl-api.ts lines 65–71).

**5. `fantasyPoints` field naming**

`TeamMetricSet.fantasyPoints` maps to `PlayerStats.dreamTeamPoints` (AFL Fantasy /
DreamTeam). The naming discrepancy is a historical artifact. The transform should
document this mapping explicitly in a comment so it is not treated as a bug when
`footywire` uses "AF" (AFL Fantasy) and `afl-api` uses "dreamTeamPoints" for the
same stat.

### Build sketch

**Files to create:**

| File | Role |
|---|---|
| `src/transforms/computed-team-stats.ts` | Pure fold: `PlayerStats[] → TeamStatsEntry[]`. Follows the `computed-ladder.ts` pattern: no I/O, Map-accumulated, exported as a named function. |
| `test/transforms/computed-team-stats.test.ts` | Unit tests with a static fixture. Cover: basic aggregation, null propagation (simulate VFL fields), for/against symmetry, summaryType averages, single-match scope (missing homeTeam/awayTeam on some rows). |
| `test/fixtures/computed-team-stats-input.json` | Small synthetic PlayerStats fixture: 2 teams, 3 players each, 1 match. Includes some null fields to test null propagation. |

**Files to modify:**

| File | Change |
|---|---|
| `src/sources/adapters/afl-api.ts` | Add `AflApiTeamStatsSource` class that calls `fetchPlayerStats`, passes result through `computeTeamStats`, handles `summaryType`. |
| `src/sources/adapters/index.ts` | `teamStatsRegistry.register(new AflApiTeamStatsSource(aflApiClient))` — no default-source change. |

**No changes to:**
- `src/types.ts` — `TeamMetricSet` is already fully nullable; no type change needed.
- `src/api/team-stats.ts` — dispatch is registry-driven; adding an adapter is sufficient.
- `src/sources/adapters/registry.ts` — default stays `"afl-tables"` (see open question 2).

**Effort:** S–M. The pure transform is a ~100-line function. The adapter wraps an
existing PlayerStats fetch. The fixture test is straightforward. The main time cost
is the live spot-check in open question 1.

**Fixture strategy:** Create a minimal synthetic `PlayerStats[]` fixture (not a
live API snapshot) so the test is immune to upstream data changes. The fixture
should include players from two teams across one match to test both `for` and
`against` metric sets, with deliberate nulls on two fields to validate null
propagation.

---

## CONTEXT.md quotes confirmed in code

The following CONTEXT.md assertions were verified against source:

> "AFL API has no `team-stats` endpoint — `fetchTeamStats` falls back to
> `afl-tables` (or `footywire`), which means it requires `--source` for any
> request the default can't serve."

Confirmed: `registry.ts` line 60 sets `defaultSource: "afl-tables"` for
`teamStatsRegistry`. `index.ts` lines 73–74 register only FootyWire and AFL Tables;
no AFL API adapter is registered.

> "AFL API VFL/VFLW PlayerStats are partial: 20/30 core fields populated; the
> 10 advanced fields … are null."

Confirmed structurally: `src/transforms/player-stats.ts` line 101 hardcodes
`supercoachScore: null` (AFL API never provides this). The other 9 advanced null
fields propagate as `null` via `toNullable(stats?.field)` when the AFL API omits
them.

---

## Recommendation

Register `AflApiTeamStatsSource` as a new computed adapter — the type contract
accommodates it cleanly, the computed-ladder and Coleman precedents establish the
pattern, and the coverage expansion (AFLW/VFL/VFLW) is genuinely new value. Ship
as a per-round-first MVP: season queries work but are documented as slow (~10–17 s
for AFLM). Before merging, run a single live spot-check comparing summed AFL API
player kicks/freesFor/clearances for one AFLM match against the AFL Tables team
row for the same match; if the delta on freesFor or clearances is more than 1 on
more than 10% of a sample, null those fields rather than summing them. Do not change
the default source until the spot-check is green and the field-name mapping for
`dreamTeamPoints → fantasyPoints` is confirmed correct in practice.
