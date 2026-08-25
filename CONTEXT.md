# CONTEXT

Domain vocabulary and architectural concepts for fitzRoy-ts. Read this before
proposing structural changes.

## Competitions

| Code   | Name                              | Coverage requirement |
|--------|-----------------------------------|----------------------|
| `AFLM` | AFL Men's Premiership             | from 1990 (start of AFL era) |
| `AFLW` | AFL Women's Premiership           | from 2017 (full history) |
| `VFL`  | VFL / AFL Reserves men's          | from 2021 (modern AFL Reserves era) |
| `VFLW` | VFLW women's reserves             | from 2021 |

Out of scope: pre-1990 AFLM (VFL era), pre-2021 VFL/VFLW, state leagues
(SANFL, WAFL), talent leagues (U18), AFL preseason/Origin/Indigenous All Stars
(separate competitions in the AFL API).

## User-facing commands (six)

Every command shares one UX idiom: **drill in by adding flags** from a uniform
vocabulary (`-s/--season`, `-r/--round`, `--team`, `--source`, `--competition`).
Operation-specific filters extend the set per command.

| Command   | Concept                                                          |
|-----------|------------------------------------------------------------------|
| `team`    | identity with temporal zoom: `team` lists entities; season plus team returns a squad; season plus round returns a lineup |
| `player`  | biographical lookup with optional team and season filters |
| `match`   | matches in any temporal scope; `--status` filter subsumes "fixture" |
| `stats`   | performance numbers; `--by player` (default) or `--by team`       |
| `ladder`  | standings                                                         |
| `awards`  | season recognitions; `--type {brownlow,coleman,coaches,all-australian,rising-star}` |

## Canonical domain types

- **Match** — unified type for matches in any state. A "fixture" is a Match
  with `status="Upcoming"` and null score fields. There is no separate Fixture
  type.
- **Squad** — team roster with biographical fields. `scope` distinguishes a
  season squad from an all-time scraper list. The requested season remains
  query context for both scopes.
- **Lineup** — match-day team sheet. Positional fields (jumper, position,
  isEmergency, isSubstitute). Distinct from Squad.
- **PlayerStats** — per-player per-match performance numbers.
- **Award** — season recognition. Either *fetched* (Brownlow, Coaches votes,
  All-Australian, Rising Star) or *computed* (Coleman, etc.). The `awards`
  subsystem hides this distinction behind one verb.
- **Completeness envelope** — successful rows plus ordered failure metadata.
  Player stats identify matches, player details identify teams, and awards
  identify coaches rounds.

## Architectural concepts

### Source-adapter pattern with capability descriptors

Each source implements only the per-capability interfaces it satisfies
(`MatchSource`, `PlayerStatsSource`, `SquadSource`, `LadderSource`, etc.) and
declares an inline coverage map:

```ts
readonly coverage: ReadonlyMap<CompetitionCode, { minSeason: number; maxSeason?: number }>;
```

Public API functions are 3-line registry lookups: find the adapter for the
requested source, check coverage, delegate. All per-source quirks (auth,
URL building, response parsing) live in the adapter, not the api layer.

**Implementation:** `src/sources/adapters/` holds:

- `capabilities.ts` — the per-capability interfaces
- `coverage.ts` — `SeasonRange`, `CoverageMap`, `checkCoverage` helper, structured errors
- `registry.ts` — per-capability `Map<DataSource, Adapter>`s with register/get/list helpers
- `{afl-api, footywire, afl-tables, squiggle, fryzigg}.ts` — one file per source, with one class per capability the source satisfies (e.g. `AflApiMatchSource`, `AflApiPlayerStatsSource`, `AflApiSquadSource`, `AflApiLineupSource`, `AflApiLadderSource`)
- `index.ts` — bootstrap that instantiates each adapter, registers it, and re-exports the public surface

Per-capability classes (rather than one fat per-source class) exist because
coverage genuinely varies per operation: AFL Tables matches go back to 1897,
but its player stats only start ~1965; AFL Tables ladder is *computed* from
match results, so it inherits match coverage. Each capability class declares
its own `coverage` map.

### No silent cross-source fallback

If a request falls outside the chosen source's coverage, the public API
returns a structured error suggesting an alternative `--source`. Sources are
never silently swapped — see ADR-0001.

### Awards is concept-first, not source-first

`fetchAwards` dispatches on `award` type to either fetch (Brownlow from
FootyWire, Coaches from afl-coaches.com) or compute (Coleman = sum goals
across PlayerStats). Source heterogeneity is hidden from the caller. This
is the deepest module in the codebase: small interface, substantial behaviour.

### CLI consolidates, library stays factored

For `team` and `stats`, the user-facing CLI command is one verb that
dispatches to multiple library functions based on flag presence. Library
keeps precise types (Squad and Lineup have orthogonal field sets that don't
collapse cleanly into one type). The CLI dispatcher handles the consolidation.

JSON output preserves public completeness envelopes. Tables and CSV emit inner
rows. Every completeness warning uses standard error.

## Source coverage (as of 2026-05)

| Source        | AFLM                             | AFLW           | VFL    | VFLW   |
|---------------|----------------------------------|----------------|--------|--------|
| afl-api (default) | 2012+                        | 2017+          | 2021+  | 2021+  |
| afl-tables    | 1897+ results, ~1965+ stats      | —              | —      | —      |
| footywire     | ~2010+                           | —              | —      | —      |
| squiggle      | 2012+                            | —              | —      | —      |
| fryzigg       | varies                           | varies         | —      | —      |
| afl-coaches   | 2006+ (votes)                    | 2018+ (votes)  | —      | —      |

Notes:
- AFL API has no `team-stats` endpoint. The CLI defaults team stats to
  `afl-tables`. Coverage dispatch never changes a caller-selected source.
- AFL API VFL/VFLW PlayerStats are partial: 20/30 core fields populated; the
  10 advanced fields (bounces, totalPossessions, marksInside50, onePercenters,
  clangers, goalAssists, goalAccuracy, turnovers, shotsAtGoal, metresGained)
  are null. These are already nullable in the type, so no schema change.
- AFL API competition resolution uses a hardcoded `(CompetitionCode → competitionId)`
  map — the `code` field in `/competitions` is ambiguous (four entries share
  `code="AFL"`).

## Probe scripts

`scripts/probe-afl-api.ts` and `scripts/probe-afl-tables.ts` verify source
coverage. Run periodically to confirm assumptions in this document still hold.
