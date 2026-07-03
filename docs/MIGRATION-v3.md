# Upgrading from 3.0.x

All changes in 3.1.x–3.4.x are backwards-compatible at the TypeScript API
level. If you are on any 3.0.x release you can upgrade to the latest `^3`
with no call-site changes beyond the 3.0.0 breaking changes listed below.

**CHANGELOG read confirms:** no `BREAKING` markers appear in any 3.1.0,
3.1.1, 3.2.0, 3.3.0, or 3.4.0 section. The migration steps below apply only
if you are upgrading from a 2.x or early-3.0.0 baseline.

---

## Breaking changes introduced in 3.0.0

These changes require call-site updates when coming from 2.x:

### Return type: `fetchPlayerStats`

`fetchPlayerStats` now returns a `SeasonPlayerStats` envelope:

```typescript
// Before (2.x)
const result = await fetchPlayerStats({ source: "afl-tables", season });
// result.data was PlayerStats[]

// After (3.0+)
const result = await fetchPlayerStats({ source: "afl-tables", season });
// result.data is { stats: PlayerStats[]; failedMatchIds: string[] }
// Read result.data.stats where you previously read result.data
```

### FootyWire match goals/behinds are now `null`

`homeGoals`, `homeBehinds`, `awayGoals`, `awayBehinds` are `null` for
`source: "footywire"` match rows. The previous values were fabricated from
total points (`floor(points / 6)`) and were wrong. Use `homePoints` /
`awayPoints` for FootyWire match results.

### Removed deprecated aliases

- `parseAflApiDate`, `parseAflApiMatchTime`, `parseAflTablesDate`,
  `parseFootyWireDate` → use `parseDate`
- `SquadPlayer` type alias → use `Player`

### Wire schemas moved to `fitzroy/schemas`

Raw AFL API and Squiggle response types (`MatchItemSchema`,
`CompetitionListSchema`, etc.) moved from the package root to the
`fitzroy/schemas` subpath export. Update imports accordingly:

```typescript
// Before (2.x / early 3.0.0 alpha)
import { MatchItemSchema } from "fitzroy";

// After (3.0+)
import { MatchItemSchema } from "fitzroy/schemas";
```

---

## What changed in each 3.x release

### 3.0.1

- AFL API pre-game statuses (`UNCONFIRMED_TEAMS`, `CONFIRMED_TEAMS`,
  `PLACEHOLDER`) now correctly map to `Upcoming` instead of `Complete`.
  Unknown statuses also default to `Upcoming`.

### 3.1.0

- **Venue timezone** — `Match.venueLocalDate` added (wall-clock start from
  the AFL API, for "7:30pm at the venue" display without UTC conversion);
  `Match.venueTimezone` is now consistently IANA across all sources.
- **Source provenance** — `source: DataSource` added to `Ladder`, `Lineup`,
  `Squad`, `Team`, and all `Award` variants. Previously only `Match`,
  `Player`, `PlayerStats`, and `TeamStatsEntry` carried this field.
- **`Match.matchClockPeriods` / `completedQuarter`** — surfaces the AFL
  API's break-detection signal for live-match consumers (addresses a 2026
  upstream regression where `score.status` stopped transitioning).
- **`Ladder.asOfMatch`** — AFL Tables ladder now pins the snapshot to the
  latest completed match ID at-or-before the requested round.
- **New `DataSource` variant** — `"afl-coaches"` distinguishes the
  `afl-coaches.com.au` scraper from FootyWire in `CoachesVote.source`.

### 3.1.1

- DST spring-forward gap handling — AFL Tables date parsing now rolls
  forward one hour for times inside a non-existent wall-clock window
  (e.g. 02:30 during Melbourne DST change) instead of silently mapping to
  midnight UTC.
- CSV injection defence — CLI CSV exporter now prefixes formula-starting
  cells (`=`, `+`, `-`, `@`, tab) with a single apostrophe.

### 3.2.0

- **Zero-nulling fix** — scraped numeric fields (attendance, goals, weight,
  etc.) no longer collapse a legitimate `0` to `null`. The previous
  `parseInt(...) || null` idiom treated `0` as absent.
- **Data-driven default season** — the default season (when `--season` is
  omitted) is now resolved from the AFL round schedule rather than the
  local calendar year. `fetchPlayerDetails` defaults the same way.

### 3.3.0

- **Fryzigg coverage caps corrected** — AFLM now covers through 2025; AFLW
  is capped at 2022 (the upstream dump has not updated since January 2022).
  Queries outside these bounds now return a coverage error suggesting
  `--source afl-api` instead of returning empty results.
- **FootyWire concurrent fetching** — season player-stats scrapes now fetch
  each match's basic and advanced pages concurrently (~2× fewer round-trips).
- **Non-TTY ambiguity now errors** — piped runs with an ambiguous
  `--team`/`--match` name now exit with an error listing candidates instead
  of silently using the best fuzzy match.

### 3.4.0

- **AFL Tables Brisbane Lions slug corrected** (`brisbane` → `brisbanel`) —
  `fetchSquad`/`fetchPlayerDetails` with `source: "afl-tables"` for Brisbane
  Lions previously targeted a missing page. If you worked around this with
  your own slug override, it is deletable.
- **Round-label helpers added** — `roundLabel`, `roundAbbreviation`, and
  `roundTypeLabel` are exported from the package root (R fitzRoy
  `round.name`/`round.abbreviation`/`round.type` parity). If you hand-roll
  round-label derivation, these replace it. Purely additive.

---

## Behavioural changes to check during upgrade

These are not breaking changes but may affect downstream consumers:

1. **Fryzigg AFLW queries** — if you call `fetchPlayerStats({ source:
   "fryzigg", competition: "AFLW", season: 2023 })` or later, you will now
   receive a coverage error rather than empty results. Switch to
   `source: "afl-api"` for recent AFLW player stats.

2. **All-teams `fetchPlayerDetails` error** — the all-teams mode (no
   `team` specified) now returns an error when every team's squad fetch
   fails, rather than an empty success. Check `result.success` before
   reading `result.data`.

3. **Coaches votes round counting** — finals rounds are now detected per
   season instead of assuming 23 H&A rounds. If you were querying round 24+
   coaches votes for 2023–2025 seasons, previously those rounds were
   silently dropped.

4. **Non-TTY disambiguation** — scripts that pipe `fitzroy` output and pass
   an ambiguous team/match name will now exit 1 instead of picking the
   closest match. Pass an exact name or match ID in automation.

---

## Consumer notes

These notes are for consumers who implemented workarounds against older
versions of this library and may safely remove them:

### Team name aliases (unnecessary ≥2.2.0)

Sir Doug Nicholls Round indigenous team names (`Kuwarna`, `Walyalup`,
`Narrm`, `Yartapuulti`, `Euro-Yroke`, `Waalitj Marawar`) have been
registered as canonical aliases since v2.2.0. Any hand-rolled
`TEAM_NAME_MAP` that duplicates these mappings "against fitzroy regressions"
can be removed — normalisation is handled internally.

### Fryzigg `brownlowVotes` / `supercoachScore` (available since v3)

The typed Fryzigg transform (`src/transforms/fryzigg-player-stats.ts`)
has carried `brownlowVotes` and `supercoachScore` on every `PlayerStats`
row since v3. These fields are populated directly from the upstream RDS
column data and do not require hand-plumbing in consumer code.
