# Report 023: PlayerStats defaults-factory investigation

**Status:** Complete — NO-GO
**Date:** 2026-07-02
**Audited commit:** 05d088c (drift check: no changes to `src/transforms/` or `src/types.ts` since baseline)

---

## Step 1: Quantify the duplication and its actual cost

### PlayerStats interface

`src/types.ts:217` — **81 total fields**.

### Per-source field counts

| Category | AFL API (`player-stats.ts`) | AFL Tables (`afl-tables-player-stats.ts`) | FootyWire (`footywire-player-stats.ts`) | Fryzigg (`fryzigg-player-stats.ts`) |
|----------|---:|---:|---:|---:|
| Real values (from data) | 80 | 34 | 27 | 68 |
| Conditional real (`adv?.xxx ?? null`) | 0 | 0 | 16 | 0 |
| Hardcoded `null` literals | 1 | 47 | 38 | 13 |
| **Total** | **81** | **81** | **81** | **81** |

**AFL API** (`player-stats.ts`): only `supercoachScore: null` is hardcoded — the API does not expose Supercoach scores. Every other field uses `toNullable(stats?.xxx)`.

**AFL Tables** (`afl-tables-player-stats.ts`): tracks 34 real values from the 25-column HTML table (plus derived player ID, team name, competition constant). 47 fields hardcoded `null` — this source predates nearly all extended-stats columns.

**FootyWire** (`footywire-player-stats.ts`): 27 fields from the basic page; 16 more come from the advanced page via `adv?.xxx ?? null` (real when the advanced page is scraped, null otherwise). 38 fields are always `null`.

**Fryzigg** (`fryzigg-player-stats.ts`): 68 real values from the column-major DataFrame (richest non-API source). 13 hardcoded `null` fields — all are derived ratio statistics only the AFL API computes.

### Fields null in all non-API sources (the "universal null" bucket)

These 13 fields are hardcoded `null` in AFL Tables, FootyWire, AND Fryzigg, while the AFL API returns a real value:

| Field | AFL API | AFL Tables | FootyWire | Fryzigg |
|-------|---------|------------|-----------|---------|
| `goalAccuracy` | real | null | null | null |
| `goalEfficiency` | real | null | null | null |
| `shotEfficiency` | real | null | null | null |
| `interchangeCounts` | real | null | null | null |
| `kickEfficiency` | real | null | null | null |
| `kickToHandballRatio` | real | null | null | null |
| `hitoutToAdvantageRate` | real | null | null | null |
| `contestedPossessionRate` | real | null | null | null |
| `contestOffWinsPercentage` | real | null | null | null |
| `contestDefLossPercentage` | real | null | null | null |
| `centreBounceAttendances` | real | null | null | null |
| `kickins` | real | null | null | null |
| `kickinsPlayon` | real | null | null | null |

All 13 are derived ratio or count stats produced only by the AFL API's `extendedStats` block.

### Source-specific defaults that differ across sources (load-bearing differences)

At least 23 additional fields show meaningful source-level variation:

| Field | AFL API | AFL Tables | FootyWire | Fryzigg | Note |
|-------|---------|------------|-----------|---------|------|
| `supercoachScore` | **null** | **null** | real | real | API and AFL Tables have no SC score |
| `brownlowVotes` | real | real | **null** | real | FW has no BR column |
| `date` | real | **null** | **null** | real | Scrapers omit match date |
| `homeTeam` / `awayTeam` | real | **null** | **null** | real | Same — scrapers omit context |
| `jumperNumber` | real | real | **null** | real | FW omits jumper number |
| `dreamTeamPoints` | real | **null** | real | real | AFL Tables has no DT score |
| `intercepts` | real | **null** | cond. | real | AT table predates intercepts col |
| `centreClearances` / `stoppageClearances` | real | **null** | cond. | real | AT table has only `totalClearances` |
| `turnovers` | real | **null** | cond. | real | AT table column not present |
| `disposalEfficiency` | real | **null** | cond. | real | AT table column not present |
| `metresGained` | real | **null** | cond. | real | AT table column not present |
| `tacklesInside50` | real | **null** | cond. | real | AT table column not present |
| `scoreInvolvements` | real | **null** | cond. | real | AT table column not present |
| `effectiveDisposals` | real | **null** | cond. | real | AT table column not present |
| `effectiveKicks` | real | **null** | **null** | real | API + Fryzigg only |
| `shotsAtGoal` | real | **null** | **null** | real | FW and AT lack this stat |
| `totalPossessions` | real | **null** | **null** | real | FW and AT lack this stat |
| `ratingPoints` | real | **null** | **null** | real | FW and AT lack this stat |
| `position` | real | **null** | **null** | real | FW and AT lack position metadata |
| `pressureActs` / `defHalfPressureActs` | real | **null** | **null** | real | API + Fryzigg only |
| `spoils` | real | **null** | **null** | real | API + Fryzigg only |
| `hitoutsToAdvantage` / `hitoutWinPercentage` | real | **null** | **null** | real | API + Fryzigg only |
| `groundBallGets` / `f50GroundBallGets` | real | **null** | **null** | real | API + Fryzigg only |
| `interceptMarks` / `marksOnLead` | real | **null** | **null** | real | API + Fryzigg only |
| `contestOffOneOnOnes` / `contestOffWins` | real | **null** | **null** | real | API + Fryzigg only |
| `contestDefOneOnOnes` / `contestDefLosses` | real | **null** | **null** | real | API + Fryzigg only |
| `ruckContests` / `scoreLaunches` | real | **null** | **null** | real | API + Fryzigg only |

### Has drift actually happened?

No. The null defaults are consistent across all four files. No field that is null in one file has a real value in another where it should also be null.

### Git evidence: realized lockstep cost

Commits in the last 6 months that touched multiple transform files:

| Commit | Description | Files touched |
|--------|-------------|---------------|
| `02a09fe` | Add brownlowVotes, attendance, weather fields | `player-stats.ts`, `afl-tables-player-stats.ts`, `footywire-player-stats.ts` (3/4) |
| `73181a6` | v1.5.0 — add date, homeTeam, awayTeam, position, goalEfficiency, shotEfficiency, interchangeCounts, supercoachScore | `player-stats.ts`, `afl-tables-player-stats.ts`, `footywire-player-stats.ts` (3/4; fryzigg not yet added) |
| `51689ac` | Add fryzigg data source (new file) | `fryzigg-player-stats.ts` (new) |

**Conclusion:** 2 realized lockstep commits in 6 months. Critically, both added fields with real values in multiple sources (brownlowVotes is real in AFL API, AFL Tables, and Fryzigg; position/goalEfficiency/shotEfficiency/etc. are real in AFL API). Neither commit was "add a field that is null everywhere except AFL API" — which is the only scenario a null defaults factory would simplify.

---

## Step 2: Candidate design (on paper)

The natural candidate is a shared const:

```typescript
// src/transforms/player-stats-null-defaults.ts
export const NULL_COMPUTED_STATS = {
  goalAccuracy: null,
  goalEfficiency: null,
  shotEfficiency: null,
  interchangeCounts: null,
  kickEfficiency: null,
  kickToHandballRatio: null,
  hitoutToAdvantageRate: null,
  contestedPossessionRate: null,
  contestOffWinsPercentage: null,
  contestDefLossPercentage: null,
  centreBounceAttendances: null,
  kickins: null,
  kickinsPlayon: null,
} as const satisfies Partial<PlayerStats>;
```

Each non-API transform would spread this first:

```typescript
stats.push({
  ...NULL_COMPUTED_STATS,
  matchId: ...,
  // ... 40-60 source-specific lines still required ...
  goalAccuracy: null,  // wait — this would be redundant, the spread covers it
});
```

**TypeScript feasibility:** `as const satisfies Partial<PlayerStats>` is clean. All 13 fields are `number | null` in the interface and `null` in the const. The spread satisfies `exactOptionalPropertyTypes` (these are required-nullable, not optional). `readonly` is fine — it only restricts post-construction mutation, not the literal construction itself.

**But the savings are modest and lopsided:**

- AFL Tables (47 nulls): factory covers 13, leaving 34 source-specific nulls unchanged. Net: saves 12 lines (13 minus the spread line itself).
- FootyWire (38 nulls): factory covers 13, leaving 25 source-specific nulls unchanged. Net: saves 12 lines.
- Fryzigg (13 nulls): factory covers all 13. Net: saves 12 lines.
- AFL API (1 null): no benefit.

Total savings: ~36 lines across 3 files. Factory itself: ~17 lines (const + import in each consumer). **Net: ~19 lines saved.**

This does not reduce the dominant maintenance surface. AFL Tables still carries 34 hardcoded nulls after the factory; FootyWire carries 25. Future "add a null for sources that don't track X" edits would continue to require touching those per-source blocks unless the new field happens to be null in all three non-API sources — which the git history shows is the minority case.

---

## Step 3: Recommendation — NO-GO

**The lockstep cost is not realized in the form the factory addresses.**

The 2 realized lockstep commits added fields with *real* values across multiple sources, not fields that are universally null except in AFL API. A `NULL_COMPUTED_STATS` factory covering the 13 "AFL-API-derived ratios" would not have simplified either commit. The savings (19 net lines across 4 files, with each non-API file still carrying 25–47 source-specific hardcoded nulls) do not clear the "duplication over premature abstraction" bar in the style guide.

The null-set divergence between sources is *itself* the signal. AFL Tables has 47 nulls and Fryzigg has 13 because they genuinely track different data; these are load-bearing differences, not copy-paste slop. Abstracting the 13-field intersection obscures the fact that each source still carries its own large block of "fields this source cannot populate" and gives false confidence that the remaining nulls are similarly factored.

**If GO conditions would be met:**
- A pattern of repeatedly adding fields that are null in exactly the 3 non-API sources (not yet observed in history)
- OR the AFL Tables null set contracts significantly (e.g. the source starts providing extended stats), collapsing the per-source null divergence

**For the plans index — rejection line:**

> Plan 023 (PlayerStats defaults factory) — investigated 2026-07-02, NO-GO. 13 "AFL-API-only ratio" fields are universally null in the other 3 sources, but 2 realized lockstep commits in 6 months did not involve these fields. Each source's remaining 25–47 source-specific nulls are load-bearing; the factory saves 19 net lines and does not reduce the dominant maintenance surface. Re-evaluate only if a new source joins where its null set matches an existing source's, or if the 13-field "universal null" set grows to ≥25 through repeated lockstep field additions.

---

## Verification

- No `src/` files modified (drift check: `git diff --stat 05d088c..HEAD -- src/` = empty).
- `npm run test`: 45 test files, 451 tests — all passed.
