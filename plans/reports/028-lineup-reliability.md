# Report 028: Lineup reliability — second source, announced-vs-fielded, known gaps

**Spike date**: 2026-07-02  
**Baseline commit**: `9b1705c` (drift check: no changes in `src/sources/adapters/`, `src/types.ts`, `src/api/lineup.ts`)  
**Status**: COMPLETE

---

## 1. Consumer evidence (AFL-MCP)

Source: `git clone --depth 5 https://github.com/jackemcpherson/AFL-MCP /tmp/afl-mcp-spike`

### 1.1 Announced-vs-fielded

**`src/sync/upserts.ts:32` (AFL-MCP)**:

```
const MIN_LINEUP_SYNC_YEAR = 2023;
```

```
/**
 * Lineups for seasons before this year were derived from `player_match_stats`
 * by migration 0007 (one-time historical backfill). The AFL API publishes only
 * the Thursday-night announced team for those years, so a sync against them
 * would replace the stats-derived rows with players who didn't actually take
 * the field. `upsertLineups` filters by this constant to make that regression
 * impossible from any caller (cron, manual scripts, future backfills).
 */
```

This is the load-bearing evidence. For seasons before 2023 the AFL API roster
endpoint (`/cfs/afl/matchItems/round`) returns the announced team sheet —
the Thursday-night selection — not who actually played. Substitutions,
late withdrawals, and emergencies called up on game day produce a different
22 from the announced 22. AFL-MCP's historical backfill (migration 0007) used
player-match-stats as a proxy for fielded players, and the constant guards
against any future AFL API sync overwriting that data.

Whether the AFL API returns fielded data for 2023+ is not confirmed by this
consumer evidence; `MIN_LINEUP_SYNC_YEAR = 2023` says only that the guard
is applied from 2023 onward.

### 1.2 AFL API missing rounds

**`scripts/probe-missing-lineups.ts` (AFL-MCP)** probes the AFL API via
`fetchLineup({ source: "afl-api", ... })` for:

| Year | Round | Notes in script |
|------|-------|-----------------|
| 2015 | 4     | `// fitzroy afl-api fails here` |
| 2017 | 8     | — |
| 2018 | 9     | — |
| 2019 | 11    | — |

Adjacency sanity checks (2015 R3, R5; 2017 R7, R9) and 2015 finals rounds
(R24–R27) are also probed. The script inspects `.error.message`, `.error.issues`,
and `.error.cause` on failure — indicating the failures are actual errors (not
empty arrays), though the specific error type is not recorded here.

### 1.3 AFL Tables probe in AFL-MCP

**`scripts/probe-afltables-lineups.ts` (AFL-MCP)** calls
`fetchLineup({ source: "afl-tables", ... })` — this source does **not exist
yet** in fitzRoy-ts. The script was written as a readiness test for the
anticipated AFL Tables lineup source, sampling 2021 R1, 2022 R1, and the
four failing rounds. It checks player count and prints a sample player JSON.

### 1.4 Backfill approach for 2015–2019

**`scripts/backfill-lineups-early.ts` (AFL-MCP)** calls the AFL API for
seasons 2015–2019, joins to DB matches by `year|round_number|homeTeam`, and
generates SQL for `match_lineups`. This shows the AFL API does return data
for most 2015–2019 rounds (the failures are specific rounds, not entire
seasons) — but what it returns is the announced team, hence the stats-derived
backfill remaining canonical.

---

## 2. Probe findings

Script: `scripts/probe-afl-tables-lineup-source.ts`

### 2.1 Page structure

URL: `https://afltables.com/afl/stats/games/YYYY/GAME_ID.html`

These are the **same pages** already fetched by `AflTablesClient.fetchSeasonPlayerStats`
(via `extractGameUrlsFromDoc` + `parseAflTablesGameStats`). The game IDs come
from the season index page (`/afl/seas/YYYY.html`), which is also already
fetched.

Each page has:
- 2 `<table class="sortable">` tables for the stats (one per team). A second
  pair of tables shows per-player career details; they lack the
  "Match Statistics" header used by `parseAflTablesGameStats` to identify
  them, so they are already correctly ignored by the existing transform.
- Each stats table `<thead>` first row: `[TeamName] Match Statistics [links]`
  (same extraction already in `parseAflTablesGameStats`).
- Each stats table `<tbody>`: one `<tr>` per fielded player. Columns:
  `#(0), Player(1), KI(2), MK(3), HB(4), DI(5), GL(6)…` (24 stats columns
  already mapped in `parseAflTablesGameStats`).
- Column 0 (jumper number): may contain `↑` (subbed on) or `↓` (subbed off)
  Unicode arrows appended to the digit. The existing `parseName` function
  in `afl-tables-player-stats.ts` already strips these: `.replace(/[↑↓]/g, "")`.
- Column 1 (player name): `<a href="../../players/INITIAL/First_Last.html">Surname, First</a>`.
  Player ID derivable as `AT_${displayName.replace(/\s+/g, "_")}` — same
  convention as `PlayerStats` from this source.
- **No position column** — `matchPosition` must be `null` for all players.
- **No emergency section** — emergencies do not appear (they did not play);
  `isEmergency` must be `false` for all players.

### 2.2 Substitute markers

The `↑`/`↓` arrows in the jumper cell correspond to the AFL's interchange sub
rule. Semantics per the abbreviations key on the page:

| Arrow | Meaning             | `isSubstitute` |
|-------|---------------------|----------------|
| `↑`   | subbed **on**       | `true`         |
| `↓`   | subbed **off**      | `false` (started; subbed out mid-game) |
| none  | played full game or interchange only | `false` |

The number of `↑` arrows equals the number of `↓` arrows per team per page
(4 of each observed in the 2015 R4 sample — representing 4 interchange sub
events, which in an earlier AFL sub rule era means the "official" sub rotation).

### 2.3 Coverage map (sampled)

| Year | Round | AFL API status | AFL Tables players/team | Games |
|------|-------|----------------|-------------------------|-------|
| 2024 | R1    | works (2023+)  | 23 (medical-sub era)    | 216 in season |
| 2019 | R11   | **FAILS**      | 22                      | 9 ✓ |
| 2018 | R9    | **FAILS**      | 22                      | 9 ✓ |
| 2017 | R8    | **FAILS**      | 22                      | 9 ✓ |
| 2015 | R4    | **FAILS**      | 22                      | 9 ✓ |
| 2010 | R1    | works          | 22                      | 186 in season |
| 2000 | R1    | works (if asked) | 22                    | 185 in season |
| 1990 | R1    | —              | 20 (pre-interchange)    | 161 in season |
| 1980 | R1    | —              | 20                      | 138 in season |
| 1965 | R1    | —              | 20                      | 112 in season |
| 1950 | R1    | —              | 20                      | 112 in season |

Player count reflects the era's rules (20 = 18 field + 2 emergency bench in
the VFL era; 22 = 18 field + 4 interchange; 23 = 22 + medical sub introduced
from 2024). Coverage appears to extend back to at least 1950 and the season
index (`/seas/YYYY.html`) links exist to 1897 though stats-column parsing
for very early games was not verified.

### 2.4 AFL API announced-vs-fielded probe

**Skipped.** The AFL API token endpoint (`aflapi.afl.com.au/afl/v2/token`)
returned HTTP 403 from this environment — it requires WMCTok credentials not
available in the spike environment. The consumer evidence in §1.1 is treated
as authoritative for the announced-vs-fielded distinction.

---

## 3. Design decisions

### 3.1 AflTablesLineupSource feasibility — FEASIBLE

**Verdict**: build it. Coverage is complete for all known AFL API failure
rounds and extends the lineup capability back to ~1950 (plausibly 1897 with
additional verification). The parsing surface is a strict subset of the
existing `parseAflTablesGameStats` logic — only columns 0 and 1 are needed,
with team-name extraction from the thead identical to what already works.

**Coverage declaration** for the new source:

```ts
const AFL_TABLES_LINEUP_COVERAGE: CoverageMap = new Map([
  ["AFLM", { minSeason: 1897 }],
]);
```

Conservative `minSeason` of 1897 matches the match-results coverage already
declared; verify game-page availability for pre-1950 seasons before shipping
if deep history is a goal.

**Fields and derivability**:

| `LineupPlayer` field | Derivable? | How |
|----------------------|------------|-----|
| `playerId`           | Yes        | `AT_${displayName.replace(/\s+/g, "_")}` |
| `givenName`          | Yes        | parse "Surname, First" from col 1 |
| `surname`            | Yes        | parse "Surname, First" from col 1 |
| `displayName`        | Yes        | combine above |
| `jumperNumber`       | Yes        | col 0 digits, strip `↑↓` |
| `matchPosition`      | **No**     | always `null` |
| `isEmergency`        | **No**     | always `false` (emergencies absent) |
| `isSubstitute`       | Partial    | `true` if `↑` in col 0; `false` otherwise |

`Lineup` envelope fields:

| `Lineup` field   | Derivable? | How |
|------------------|------------|-----|
| `matchId`        | Yes        | `AT_${aflTablesGameId}` |
| `season`         | Yes        | from query |
| `roundNumber`    | Yes        | from season-page round context (same as existing `roundByGameId` map in `AflTablesClient`) |
| `homeTeam`       | Yes        | from page title or season-page row |
| `awayTeam`       | Yes        | from page title or season-page row |
| `homePlayers`    | Yes        | first sortable table |
| `awayPlayers`    | Yes        | second sortable table |
| `competition`    | Yes        | from query (AFLM only) |
| `source`         | Yes        | `"afl-tables"` |

**AFLM-only**. AFL Tables covers AFL Men's only. AFLW and VFL are out of
scope for this source.

**matchId portability caveat**: `AT_` prefixed IDs are not AFL API IDs.
Consumers joining AFL Tables lineups to AFL API match results must use
`season + roundNumber + homeTeam` as the join key, not `matchId`. This is
the same limitation already accepted for `PlayerStats` from this source and
is documented in the existing `AflTablesPlayerStatsSource` TSDoc.

### 3.2 Announced-vs-fielded modeling

**Recommendation: add `readonly kind?: "announced" | "fielded"` to `Lineup`.**

Rationale:
- **Opt-in, non-breaking** — with `exactOptionalPropertyTypes` enabled,
  an optional field is additive: existing `Lineup` constructors in
  `transformMatchRoster` continue to compile without modification (the field
  simply won't be set, giving `undefined`). A required field would be a semver
  major bump.
- **Vocabulary** — "kind" is neutral and brief. "teamSheetKind" is more
  explicit but verbose; CONTEXT.md says "Lineup — match-day team sheet" so
  the noun is already implied.
- **Semantics per source**:
  - `AflApiLineupSource`: set `kind: "announced"` (honest about what the API
    returns for pre-2023 data; for 2023+ the correct value is unknown until
    the AFL API is probed with credentials — stamp `"announced"` until proven
    otherwise, or leave absent until the probe runs).
  - `AflTablesLineupSource`: set `kind: "fielded"` (always from game stats).
- **Migration impact**: zero breaking changes. Consumers reading `lineup.kind`
  will see `undefined` from any source that hasn't been updated yet, which
  they can treat as "unknown" — safer than stamping the wrong value.
- **Alternative considered — per-player flag**: would let the consumer
  distinguish "announced but did not play" players from "fielded" players
  within a single lineup object. AFL Tables cannot support this because
  it only has the fielded players; the AFL API announced rosters sometimes
  exceed 22 (emergencies). A per-player flag is a heavier model that requires
  a richer data source than AFL Tables provides. Defer to a future source
  (e.g. if official AFL team-sheet HTML becomes available).
- **Alternative considered — TSDoc-only warning**: not machine-readable.
  Consumers cannot branch on it; AFL-MCP already has `MIN_LINEUP_SYNC_YEAR`
  as a workaround. A typed field lets them remove that workaround.

### 3.3 Known-gaps data (missing AFL API rounds)

**Recommendation: TSDoc warning on `AflApiLineupSource.fetchLineup`, not a
queryable constant.**

The four known gaps (2015 R4, 2017 R8, 2018 R9, 2019 R11) are AFL API
failures — specific rounds that the API errors on. Once `AflTablesLineupSource`
is registered, consumers who hit an AFL API error on lineup can fall back to
`source: "afl-tables"` per ADR-0001's suggested-alternative pattern, without
needing to know the specific missing-round list.

A library constant like `AFL_API_LINEUP_MISSING_ROUNDS` would:
- Need to be maintained if more rounds are discovered to fail.
- Be redundant once AFL Tables is available (the correct answer is "use
  afl-tables for any year/round that matters").
- Create a dependency on specific historical knowledge that may change if
  the AFL retroactively patches their API.

The TSDoc on `AflApiLineupSource` should note: "Known gaps: rounds 2015 R4,
2017 R8, 2018 R9, 2019 R11 return errors from the AFL API. Use
`source: 'afl-tables'` for those rounds." This is discoverable at
definition-hover time without creating a public API surface.

---

## 4. Build plan sketch

### Files

| File | Change |
|------|--------|
| `src/sources/adapters/afl-tables.ts` | Add `AflTablesLineupSource` class |
| `src/sources/adapters/index.ts` | Register `AflTablesLineupSource` in `lineupRegistry` |
| `src/transforms/afl-tables-lineup.ts` | New pure transform: game stats HTML → `LineupPlayer[]` pairs (cols 0+1 only; extract team name from thead) |
| `src/types.ts` | Add `readonly kind?: "announced" \| "fielded"` to `Lineup` interface |
| `src/transforms/lineup.ts` | Stamp `kind: "announced"` in `transformMatchRoster` |
| `test/fixtures/afl-tables/lineups/` | 2–3 snapshot HTML files: one modern (2024), one pre-2023, one pre-interchange (1980s) |
| `test/transforms/afl-tables-lineup.test.ts` | Fixture-based tests for `parseAflTablesGameLineup` |
| `test/sources/adapters/afl-tables-lineup.test.ts` | Integration test for `AflTablesLineupSource.fetchLineup` (mocked client) |

### Reuse opportunity

The new `parseAflTablesGameLineup` function in `afl-tables-lineup.ts` is
deliberately separate from `parseAflTablesGameStats` in `afl-tables-player-stats.ts`
to honour the single-responsibility principle — lineup and stats are different
query paths. However, the team-name extraction logic (`/^(\w[\w\s]+?)\s+Match Statistics/i`)
and the sub-marker stripping (`.replace(/[↑↓]/g, "")`) can be shared utilities
or inlined since they are each one line.

`AflTablesClient` already holds all the fetch infrastructure needed:
- `extractGameUrlsFromDoc` to get game IDs from the season page
- `parseSeasonPageGamesFromDoc` for the `roundByGameId` map
- `batchedMap` for concurrent per-game fetches

The new `AflTablesClient.fetchSeasonLineups(year)` method is structurally
identical to `fetchSeasonPlayerStats`, but calls `parseAflTablesGameLineup`
instead of `parseAflTablesGameStats`. The implementation should be ~50 lines.

### Effort: S (Small)

- One new transform function (~40 lines, pure, trivially testable).
- One new adapter class (~30 lines, mirrors existing adapter pattern).
- One new client method (~40 lines, mirrors `fetchSeasonPlayerStats`).
- 2–3 fixture HTML files (snapshots of the probe pages already fetched).
- ~60 lines of tests.

### Ordering

**Must land AFTER plan 026** (AFL Tables team-slug audit). Both touch
`src/sources/afl-tables.ts` and `src/sources/adapters/afl-tables.ts`. Plan
026 may rename slug mappings used by `normaliseTeamName` which `AflTablesLineupSource`
will call to normalise home/away team names — merging before 026 ships risks
a conflict or incorrect normalisation.

Suggested sequence: 026 → 027 → this build plan.

---

## 5. Open questions for the maintainer

1. **AFL API 2023+ fielded vs announced**: the spike could not probe the AFL
   API directly (403 on token endpoint). For 2023+, should `AflApiLineupSource`
   stamp `kind: "announced"` (conservative) or `kind: "fielded"` (optimistic)?
   Suggest stamping `"announced"` and updating once a credentialed probe
   confirms fielded semantics. Alternatively, stamp the field `undefined` for
   AFL API and only populate it in the AFL Tables source, letting `undefined`
   signal "unknown".

2. **Medical sub (2024, 23 players)**: the 23rd player in the AFL Tables stats
   page is the medical substitute — they receive a sub marker (`↑`) but they
   are `isSubstitute: true` in the proposed model, which conflates the medical
   sub with the interchanged player. Is a third `isEmergency`-style flag needed
   for the medical sub specifically? The existing `LineupPlayer` type has
   `isEmergency` (always `false` from AFL Tables) and `isSubstitute`. A
   `isMedicalSub` flag or `matchPosition: "MEDSUB"` could disambiguate.

3. **Pre-1965 completeness**: the player-stats existing coverage says
   `minSeason: 1965`. The lineup transform (columns 0+1 only) may work for
   earlier years; verify a 1930s game page before declaring `minSeason: 1897`.

4. **Player ID cross-source join**: `AT_` prefixed player IDs do not join to
   AFL API player IDs. AFL-MCP already handles this via stats-derived data.
   If a consumer wants to join AFL Tables lineups to AFL API player records
   by name, a name-normalisation utility (like `normaliseTeamName` for teams)
   may be needed. Out of scope for this plan but note the dependency.
