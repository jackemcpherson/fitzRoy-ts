# Upgrading from 3.0.X

Later version 3 releases retain TypeScript API compatibility with the initial
version 3 API.
Upgrades from version 2 require the 3.0.0 changes below.

---

## Breaking Changes Introduced in 3.0.0

These changes require call-site updates when coming from 2.x:

### Return Type: `fetchPlayerStats`

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

### FootyWire Match Goals/behinds Are Now `null`

`homeGoals`, `homeBehinds`, `awayGoals`, `awayBehinds` are `null` for
`source: "footywire"` match rows. The old transform derived incorrect values
from total points with `floor(points / 6)`. Use `homePoints` and `awayPoints`
for FootyWire match results.

### Removed Deprecated Aliases

- `parseAflApiDate`, `parseAflApiMatchTime`, `parseAflTablesDate`,
  `parseFootyWireDate` to use `parseDate`
- `SquadPlayer` type alias to use `Player`

### Wire Schemas Moved to `fitzroy/schemas`

Raw AFL API and Squiggle response types, including `MatchItemSchema` and
`CompetitionListSchema`, moved from the package root to the `fitzroy/schemas`
subpath export. Update imports accordingly:

```typescript
// Before (2.x / early 3.0.0 alpha)
import { MatchItemSchema } from "fitzroy";

// After (3.0+)
import { MatchItemSchema } from "fitzroy/schemas";
```

---

## What Changed in Each 3.X Release

Review the releases between the source and target versions.

### 3.0.1

- AFL API pre-game statuses (`UNCONFIRMED_TEAMS`, `CONFIRMED_TEAMS`,
  `PLACEHOLDER`) now correctly map to `Upcoming` instead of `Complete`. Unknown
  statuses also default to `Upcoming`.

### 3.1.0

- Venue timezone: `Match.venueLocalDate` added for displaying venue-local start
  times without UTC conversion. `Match.venueTimezone` is now consistently IANA
  across all sources.
- Source provenance: `source: DataSource` added to `Ladder`, `Lineup`, `Squad`,
  `Team`, and all `Award` variants. Previously only `Match`, `Player`,
  `PlayerStats`, and `TeamStatsEntry` carried this field.
- `Match.matchClockPeriods` / `completedQuarter`: surfaces the AFL API's
  break-detection signal for live-match consumers (addresses a 2026 upstream
  regression where `score.status` stopped transitioning).
- `Ladder.asOfMatch`: AFL Tables ladder now pins the snapshot to the latest
  completed match ID at-or-before the requested round.
- New `DataSource` variant: `"afl-coaches"` distinguishes the
  `afl-coaches.com.au` scraper from FootyWire in `CoachesVote.source`.

### 3.1.1

- AFL Tables date parsing now moves times in the daylight-saving gap forward one
  hour. For example, this rule moves 02:30 during the Melbourne change.
- CSV injection defence - CLI CSV exporter now prefixes formula-starting cells
  (`=`, `+`, `-`, `@`, tab) with a single apostrophe.

### 3.2.0

- Zero-nulling fix: scraped numeric fields such as attendance, goals, and weight
  no longer collapse a legitimate `0` to `null`. The previous
  `parseInt(...) || null` idiom treated `0` as absent.
- Data-driven default season: the AFL round schedule now supplies the default
  season when you omit `--season`. The local calendar year no longer supplies it.
  `fetchPlayerDetails` defaults the same way.

### 3.3.0

- Fryzigg coverage caps corrected: AFLM now covers through 2025. AFLW coverage
  ends at 2022 because its upstream dump has not changed since January 2022. Queries
  outside these bounds now return a coverage error suggesting `--source afl-api`
  instead of returning empty results.
- FootyWire concurrent fetching: season player-stat scrapes now fetch each
  match's basic and advanced pages concurrently.
- Non-TTY ambiguity now errors: piped runs with an ambiguous `--team`/`--match`
  name now exit with an error listing candidates instead of silently using the
  best fuzzy match.

### 3.4.0

- AFL Tables Brisbane Lions slug corrected: (`brisbane` to `brisbanel`) -
  `fetchSquad`/`fetchPlayerDetails` with `source: "afl-tables"` for Brisbane
  Lions previously targeted a missing page. If you worked around this with your
  own slug override, remove it.
- Round-label helpers added: the package root now exports `roundLabel`,
  `roundAbbreviation`, and `roundTypeLabel` (R fitzRoy
  `round.name`/`round.abbreviation`/`round.type` parity). If you hand-roll
  round-label derivation, these replace it. Purely additive.

### 3.5.0

- Provider match IDs aligned: completed AFL Tables and FootyWire match rows now
  use the same provider-derived IDs as their player-stat rows.
- Scoped queries fail closed: explicit ladder and Fryzigg round queries return
  an error when a source cannot honour the requested scope. They do not return
  unrelated unscoped data.
- Coleman rankings corrected: Coleman Medal goal totals now exclude finals.
- Fryzigg snapshot integrity: the library verifies default AFLM and AFLW
  downloads against operator-reviewed SHA-256 digests before parsing.
- Faster coaches-vote seasons: the client fetches AFL Coaches Association rounds
  in polite batches of three while retaining partial-success behaviour.
- npm installation fixed: packed consumer installs no longer invoke
  repository-only preparation tooling.

---

## Behavioural Changes to Check During Upgrade

These behavioural changes may affect downstream consumers:

1. **Fryzigg AFLW queries** - if you call
   `fetchPlayerStats({ source: "fryzigg", competition: "AFLW", season: 2023 })`
   or later, you will now receive a coverage error rather than empty results.
   Switch to `source: "afl-api"` for recent AFLW player stats.

2. **All-teams `fetchPlayerDetails` error** - the all-teams mode (no `team`
   specified) now returns an error when every team's squad fetch fails, rather
   than an empty success. Check `result.success` before reading `result.data`.

3. **Coaches votes round counting** - finals rounds are now detected per season
   instead of assuming 23 H&A rounds. If you were querying round 24+ coaches
   votes for 2023 - 2025 seasons, previously those rounds were silently dropped.

4. **Non-TTY disambiguation** - scripts that pipe `fitzroy` output and pass an
   ambiguous team/match name will now exit 1 instead of picking the closest
   match. Pass an exact name or match ID in automation.

5. **Scraper match ID correction** - AFL Tables match rows previously used
   `AT_<season>_<ordinal>` while their player-stat rows used `AT_<providerId>`.
   FootyWire fixture rows similarly used `FW_<season>_R<round>_G<ordinal>` even
   when the completed match linked to the provider ID used by player stats.
   Completed rows now use `AT_<providerId>` and `FW_<providerId>` consistently.
   Rows without a provider link use explicit `AT_SYNTH_<season>_<ordinal>` or
   `FW_SYNTH_<season>_R<round>_G<ordinal>` fallback IDs. Do not persist synthetic
   IDs as stable identifiers. Their values depend on the current source-page
   order and can change when the provider edits its page.

---

## Consumer Notes

These notes are for consumers who implemented workarounds against older versions
of this library and may safely remove them:

### Team Name Aliases Since 2.2.0

Version 2.2.0 registered the Sir Doug Nicholls Round names `Kuwarna`,
`Walyalup`, `Narrm`, `Yartapuulti`, `Euro-Yroke`, and `Waalitj Marawar` as
canonical aliases. Remove any `TEAM_NAME_MAP` that duplicates them. Internal
normalisation now handles these names.

### Fryzigg `brownlowVotes` / `supercoachScore` (Available Since V3)

The typed Fryzigg transform (`src/transforms/fryzigg-player-stats.ts`) has
carried `brownlowVotes` and `supercoachScore` on every `PlayerStats` row since
v3. The transform reads these fields directly from upstream RDS columns.
Consumer code does not need a separate mapping.
