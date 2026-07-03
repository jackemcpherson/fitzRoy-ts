# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `roundLabel`, `roundAbbreviation`, and `roundTypeLabel` helpers in
  `src/lib/round-labels.ts`, exported from the package root. These are pure
  functions that derive R fitzRoy `round.name` / `round.abbreviation` /
  `round.type`-equivalent values from the `roundNumber`, `roundName`, and
  `roundType` fields already present on every `Match` row — closing a gap
  where consumers hand-rolled the same derivation themselves.
- `docs/MIGRATION-v3.md` — consolidated upgrade guide covering all 3.0.x→3.3.0
  changes: per-version bullet summaries, behavioural changes to check, and
  consumer notes on removable workarounds (team-name aliases, Fryzigg fields).

### Fixed

- AFL Tables squad/player-details requests for Brisbane Lions no longer target
  a wrong or missing team page — the slug was corrected from `brisbane` to
  `brisbanel` (verified against the live site; AFL Tables distinguishes Brisbane
  Lions from Brisbane Bears `brisbaneb`). All other slugs were audited and
  confirmed correct, including `bullldogs` (triple-L), which is afltables.com's
  own spelling.
- README `fetchTeamStats` example now uses `source: "afl-tables"` (a
  registered source) instead of `"afl-api"`, which has no team-stats endpoint
  and would error when copy-pasted.

## [3.3.0] - 2026-07-02

### Changed

- Fryzigg coverage caps corrected per live-dump probe: AFLM now covers through
  2025; AFLW capped at 2022 (upstream AFLW dump has not updated since January
  2022 — such queries now return a coverage error suggesting `--source afl-api`
  instead of empty results).
- FootyWire season player-stats scrapes fetch each match's basic and advanced
  pages concurrently (~2× fewer sequential round-trips).
- In non-interactive (piped) runs, an ambiguous `--team`/`--match` name now
  exits with an error listing the candidates instead of silently using the best
  fuzzy match.

### Fixed

- `fetchPlayerDetails` (all-teams mode) now returns an error when every team's
  squad fetch fails, instead of an empty success.
- Coaches votes: finals rounds are now detected per season instead of assuming
  23 home-and-away rounds; round-24 home-and-away votes (2023+) are no longer
  dropped, and seasons with 25 H&A rounds (2024–2025) are handled correctly.

## [3.2.0] - 2026-06-28

### Fixed

- Scraped numeric fields (attendance, games played, goals, height, weight,
  jumper number, draft/debut year) no longer collapse a legitimate `0` to
  `null`. Previously the `parseInt(...) || null` idiom treated `0` as absent.
- The default season (used when `--season` is omitted) is now resolved from the
  AFL's round schedule — the current in-progress season, else the most recently
  completed — rather than the local calendar year. This fixes the season default
  being wrong for part of the year (notably AFLW, which previously defaulted via a
  `year - 1` heuristic). Falls back to the prior calendar-based approximation when
  the AFL API is unreachable.
- `fetchPlayerDetails` now resolves its default season (when `season` is omitted)
  from the AFL round schedule via the same data-driven path as the CLI, instead
  of the local calendar year. Previously it defaulted to `new Date().getFullYear()`,
  which was wrong for part of the year (notably AFLW).

### Added

- `resolveDefaultSeasonForCompetition(competition)` — async helper that resolves
  the current/most-recent season for a competition from the AFL round schedule,
  falling back to the calendar-based approximation when the API is unreachable.

### Security

- Pinned a patched `undici` (`>=7.28.0`, via the `overrides` block) to clear a
  high-severity transitive advisory pulled in through `cheerio`. The vulnerable
  code path was not reachable from this library, but the pin removes the advisory
  from downstream `npm audit` for consumers.

## [3.1.1] - 2026-06-13

### Fixed

- AFL Tables date parsing now rolls forward by one hour when a wall-clock
  time falls inside a DST spring-forward gap (e.g. 02:30 on the first
  Sunday of October in `Australia/Melbourne`). Previously the err branch
  silently mapped to midnight UTC on the same date, corrupting the
  recorded match start. The roll-forward direction matches the convention
  AFL broadcasts use when DST rolls the schedule.

### Security

- CLI CSV exporter now neutralises formula-prefix cells (CSV injection
  defence — OWASP "Formula Injection"). Values whose first character is
  `=`, `+`, `-`, `@`, or a tab are prefixed with a single apostrophe so
  spreadsheet apps (Excel, Sheets, LibreOffice Calc) treat them as
  literal text rather than evaluating them as a formula. Numeric and
  alphanumeric data is unchanged.

### Changed

- `docs/R_PARITY.md` — removed the three false "Not implemented" rows for
  Squiggle, FootyWire player stats, and AFL Tables player stats (all
  three have shipped); refined the Fryzigg row to reflect its stub status
  (`UnsupportedSourceError` for queries outside 2024). Section header
  renamed to "Data Sources With Limited Coverage".
- `SeasonPlayerStats.failedMatchIds` TSDoc now documents the per-source
  semantics: scraper sources (`afl-tables`, `footywire`) return partial
  results, while `afl-api` is fail-fast (any per-match failure aborts
  and is returned as an `err` Result). The asymmetry is intentional —
  see ADR-0003.

## [3.1.0] - 2026-06-13

### Added

- Venue timezone end-to-end (#109):
  - `Match.venueLocalDate: string | null` captures the AFL API's
    timezone-less wall-clock start (`"2025-03-13T19:30:00"`) so callers
    can show "7:30pm at the venue" without doing the UTC→tz conversion
    themselves. Null on sources that don't publish it.
  - `Match.venueTimezone` is now consistently IANA across sources. AFL
    API still publishes IANA directly; Squiggle / FootyWire / AFL Tables
    resolve via the canonical venue→IANA map. Only `null` when the
    venue isn't in the map.
  - CLI table/CSV/JSON formatters use the row's `venueTimezone` for any
    `Date` field when present — so a 7:30pm Perth match displays in AWST
    rather than 9:30pm in AEST. Defaults to Australia/Melbourne when
    the row has no IANA tz, preserving existing behaviour for non-Match
    data.

- Cross-cutting source provenance (#120). `Ladder`, `Lineup`, `Squad`,
  `Team`, and every `Award` variant (`BrownlowVote`, `AllAustralianSelection`,
  `RisingStarNomination`, `ColemanLeader`, `CoachesVote`) now carry a
  `source: DataSource` field — at the envelope level where there is one,
  per-row where there isn't. Previously only `Player`, `Match`, `PlayerStats`,
  and `TeamStatsEntry` were stamped. JSON consumers can now key-join on
  `source` across cross-source comparisons and caches.
- New `DataSource` variant: `"afl-coaches"` — used by `CoachesVote.source`
  to identify the afl-coaches.com.au scraper as distinct from FootyWire.
- `Match.matchClockPeriods: ReadonlyArray<MatchClockPeriod> | null` and the
  derived `Match.completedQuarter: 0 | 1 | 2 | 3 | 4 | null` surface the
  AFL API's authoritative break-detection signal. Through R14 2026 the
  upstream `score.status` stopped transitioning through QTR_TIME/HALF_TIME/
  3QTR_TIME — it stays on LIVE from bounce through full time — leaving
  `Match.livePeriodStatus` unreliable for siren detection. The
  `score.matchClock.periods[]` payload (always present, never typed
  through Zod) carries `periodCompleted` flags that flip within seconds of
  each real-world siren. Now captured by `MatchClockPeriodSchema`,
  surfaced as `matchClockPeriods`, and reduced to `completedQuarter` for
  the common "what break are we in?" query. Populated only on
  `source: "afl-api"` rows where the score wrapper is present; null
  elsewhere. The TSDoc on `livePeriodStatus` now warns about the 2026
  regression and points consumers at the new fields (#145).
- `Ladder.asOfMatch: string | null` pins mid-round ladder snapshots to
  the specific match that defines the cutoff. The AFL Tables ladder
  source (which synthesises the ladder from match results) populates it
  with the latest completed `matchId` at-or-before the requested round;
  Squiggle and the AFL API leave it `null` because neither exposes the
  bookmark in their ladder responses (#119).

- `team --name X --season Y --source afl-tables` now prints a stderr
  warning that AFL Tables returns the all-time team roster and the
  `--season` filter is ignored — pointing users at `--source afl-api`
  (2012+) for a season-specific squad. The TSDoc on
  `AflTablesSquadSource` already noted this; the warning surfaces the
  caveat at the call site so it doesn't go unnoticed (#88).
- `FootyWireClient.fetchSeasonFixture` and `parseFixtureList` now accept a
  `CompetitionCode`. When the parsed fixture row's month is earlier than
  the competition's season opener (AFLW: August), the date is rolled to
  the following calendar year. AFLM stays calendar-year-aligned so the
  rollover never triggers there. Defensive forward-compat for the day
  AFLW is wired to FootyWire (#111).

### Fixed

- `fetchLineup` no longer fails with `Response validation failed` for
  historical rounds where the AFL API returns `null` for venue `state`,
  `venueId` or `timeZone`. `CfsVenueSchema` now accepts both `null` and
  `undefined` on those optional fields, unblocking ingestion of ~36
  historical matches across 2015-2019 (#127).

## [3.0.1] - 2026-06-12

### Fixed

- AFL API matches with pre-game statuses `UNCONFIRMED_TEAMS`,
  `CONFIRMED_TEAMS` or `PLACEHOLDER` were mapped to `Complete`; they now
  map to `Upcoming`. Unknown raw statuses also default to `Upcoming`
  instead of `Complete`, so a new pre-game status can no longer silently
  hide upcoming fixtures from status-filtered queries.

## [3.0.0] - 2026-06-11

### Changed

- **BREAKING**: the package root now exports only the supported surface
  (fetch functions, domain types, errors, `Result`, source clients, and
  date/name utilities). Raw AFL API and Squiggle wire schemas moved to
  the new `fitzroy/schemas` subpath export so upstream drift no longer
  forces a major release; internal transform functions are no longer
  exported.

- **BREAKING for CLI-from-source users only**: `citty`, `@clack/prompts`
  and `picocolors` are now devDependencies bundled into the published
  `dist/cli.js`, so library consumers no longer install interactive CLI
  dependencies. `npx fitzroy` / the binary releases are unaffected.
- `@jackemcpherson/rds-js` bumped to ^0.3.0 (hardened parser).

### Removed

- **BREAKING**: deprecated date-parsing aliases (`parseAflApiDate`,
  `parseAflApiMatchTime`, `parseAflTablesDate`, `parseFootyWireDate`) —
  use `parseDate`. The deprecated `SquadPlayer` type alias — use
  `Player`.

### Changed

- **BREAKING**: `fetchPlayerStats` now returns a `SeasonPlayerStats`
  partial-result envelope (`{ stats, failedMatchIds }`) instead of a bare
  `PlayerStats[]`. Season scrapes (afl-tables, footywire) used to silently
  drop games whose page fetch failed — a season missing 30 games still
  looked like a complete success. Failed games are now listed in
  `failedMatchIds` (same namespace as `PlayerStats.matchId`) while the
  rest of the season is returned in `stats`. Total failure of the season
  page itself is still an `err` Result, and the CLI `stats` command prints
  a stderr warning when games are missing. Migrate by reading
  `result.data.stats` where you previously read `result.data`.
- **BREAKING**: FootyWire match-list rows no longer fabricate
  goals/behinds from total points (`floor(points / 6)` produced
  plausible-but-wrong data indistinguishable from real values
  downstream). `homeGoals`/`homeBehinds`/`awayGoals`/`awayBehinds` are
  now `null` for `source: "footywire"` matches — only
  `homePoints`/`awayPoints` are real on that page.

### Added

- All source clients now apply a default 30-second timeout to every
  outbound request, and accept `signal` (combined with the timeout via
  `AbortSignal.any`) and `timeoutMs` options. Previously a hung upstream
  could block callers indefinitely.
- Opt-in `retry5xx` client option: retries a request once (with jitter)
  on a 5xx response, so a single transient 503 no longer aborts a
  whole-season fetch.

### Fixed

- AFL Tables: season player-stats round numbers are now looked up by the
  game's AFL Tables id instead of array index, so one skipped season-page
  row no longer shifts every later game's round number.
- AFL Tables: the fallback date for unparseable date text is now midnight
  UTC on 1 January instead of local-machine-timezone midnight.
- AFL API: season resolution anchors the year with word boundaries, so a
  year embedded in a longer number in a compseason name can no longer be
  matched by mistake.
- Squiggle: `fetchMatches({ source: "squiggle", status: "Upcoming" })`
  (or `"Live"`) no longer silently returns `[]`. The adapter hardcoded
  `complete=100`; it now applies the completion filter only for
  `status: "Complete"` queries.

## [2.3.0] - 2026-06-09

### Added

- `Match.livePeriodStatus: string | null` surfaces the AFL API's
  score-level `status` field for live-match consumers (e.g. quarter-time
  / half-time / full-time siren detection). Populated only on `afl-api`
  matches when the score wrapper is present; null elsewhere. Values are
  upstream-defined raw strings (treat as opaque until a stable union is
  documented).

### Changed

- HTML parsing now uses `parse5` + `cheerio/slim` instead of the full
  `cheerio` entry, removing the transitive `node:stream` import from the
  library bundle. The library entry can now be imported into a
  Cloudflare Worker without the `nodejs_compat` flag. Parser fidelity is
  unchanged — parse5 still performs HTML5-conformant tag-soup recovery,
  which is required for FootyWire and AFL Tables scraping. The CLI
  bundle is unaffected.

## [2.2.0] - 2026-05-22

### Added

- Sir Doug Nicholls Round (SDNR) indigenous team names returned by the AFL
  API are now resolved to their canonical club names. `Kuwarna`, `Walyalup`,
  `Narrm`, `Yartapuulti`, `Euro-Yroke`, and `Waalitj Marawar` are registered
  as aliases alongside existing nicknames and abbreviations, so they are
  accepted as `--team` input on the CLI and as `MatchQuery.team` in the
  library, and they canonicalise automatically in `homeTeam`/`awayTeam`
  fields across all sources. Output is always the canonical club name.

## [2.1.0] - 2026-05-09

This release closes 43 issues from an adversarial review of v2.0
(8 issues across CLI plumbing, 25 across data correctness, library
exports, scraper quality, and polish, plus the 5 Phase 8 canonical type
contracts: `Ladder` envelope, `team` verb discriminated union,
`TeamMetricSet`, `Award` variant alignment + Brownlow enhancements,
canonical `Player`). Plus per-match Brownlow attribution from AFL
Tables (#117) and 5 follow-ups from the v2.1.0 release-smoke matrix
(#122–#126).

### Breaking changes

- **`Match.venueTimezone` now consistently emits IANA timezone strings**
  (e.g. `"Australia/Brisbane"`) across all sources. Previously: AFL API
  returned IANA, Squiggle returned offset strings (`"+11:00"`),
  FootyWire returned null, AFL Tables returned null. Squiggle and
  FootyWire now resolve via the new venue→IANA static map; AFL Tables
  resolves the same way for time-of-day-bearing matches. (#109 part 1)
- **`Match.q1Home..q4Home` (and away) from `--source afl-tables` are now
  per-quarter, not cumulative running totals.** `q1+q2+q3+q4` now equals
  the total for all sources. Anyone summing quarter splits from
  afl-tables was previously getting nonsense; output is now correct
  but the values change. (#103)
- **`Match.roundNumber === 0` is the new convention for AFL "Opening
  Round"** (introduced 2024). AFL API already used this; AFL Tables now
  matches. `-r 1` returns Round 1 proper across all sources. AFL
  Tables consumers expecting `-r 1` to mean "the first round of the
  AFL Tables season summary" (which was Opening Round for 2024+) will
  see different data. (#102)
- **Awards `--source` flag rejected.** The `awards` command never
  honoured `--source` because the dispatch is per-award-type, not
  per-source. Previously silently ignored; now Citty rejects it as an
  unknown flag. (#86)
- **`stats --by team --round X` rejected.** Previously silently dropped
  `--round` and returned season totals; now errors with a clear
  message that team-stats sources only expose season aggregates. (#94)
- **`awards --type X --round Y` rejected for season-level awards.**
  Previously silently dropped on brownlow/all-australian/rising-star/
  coleman; now errors. Coaches votes are still round-scopable. (#94)
- **`team` bare-list mode rejects `--source != afl-api`.** Only AFL API
  exposes a teams-list endpoint; the flag is no longer silently ignored
  in this branch. (#85)
- **`awards --type {brownlow,all-australian,rising-star} -c AFLW`
  rejected.** Previously silently returned AFLM data; now errors. (#82)
- **AFL Tables blank stat cells now emit `0`, not `null`,** for columns
  the source actually tracks (kicks, marks, goals, …). Matches the
  shape from afl-api / footywire. (#108)
- **Ladder `percentage` rounded to 1dp** (matches the AFL website's
  display convention; was full float precision on afl-tables and
  squiggle). (#113)
- **Default-round ladder on `--source afl-api` now resolves to the
  latest *completed* H&A round** instead of whatever the upstream
  API picks (which was an early-season snapshot). Finals don't alter
  the ladder. (#90)
- **`fitzroy ladder --json` now emits the full `Ladder` envelope**
  (`{ season, roundNumber, competition, entries }`) instead of a flat
  `LadderEntry[]`. Pipe consumers must read `.entries` for row data.
  Table and CSV output unchanged. (#101)
- **`fitzroy team --json` now emits a discriminated union `TeamResponse`**
  with `mode: "list" | "squad" | "lineup"` rather than mode-specific raw
  arrays. Each variant wraps the existing typed shape — list mode →
  `{ mode: "list", teams }`; squad mode → `{ mode: "squad", squad }`
  (now preserves `teamId`/`teamName`/`season`/`competition`); lineup
  mode → `{ mode: "lineup", lineups }`. Table and CSV output unchanged.
  (#99)
- **`SquadPlayer` and `PlayerDetails` types converged into a single
  canonical `Player` type** (19 fields). Bio fields nullable per source;
  `team`, `source`, `competition` always present on every record.
  `Squad.players` is now `Player[]`. `dateOfBirth` is now `string | null`
  (ISO 8601 `"YYYY-MM-DD"`) on every record (was `Date | null` on
  `SquadPlayer`). `LineupPlayer` is intentionally NOT converged with
  `Player` (the AFL match roster endpoint doesn't carry bio data) — it
  remains its own lean type. `LineupPlayer.position` renamed to
  `matchPosition` to disambiguate from career standing position.
  `SquadPlayer` and `PlayerDetails` retained as deprecated type aliases
  for one minor version. (#96)
- **`TeamStatsEntry.stats: Record<string, number>` removed in favour of
  `for: TeamMetricSet` and `against: TeamMetricSet`** (canonical,
  source-portable). New field `competition: CompetitionCode` added.
  AFL Tables-only metrics (`brownlowVotes`, `contestedPossessions`,
  `uncontestedPossessions`, `contestedMarks`, `marksInside50`,
  `onePercenters`, `bounces`) and FootyWire-only metrics
  (`fantasyPoints`, `supercoachPoints`) appear in both shapes as `null`
  where the source doesn't supply them. CLI table column `B` (behinds)
  was previously empty for `--source footywire` due to a `BH`/`B` key
  mismatch — now populated correctly via canonical `for.behinds`. (#98)
- **`Award` discriminated union variants aligned:**
  `CoachesVote.playerName` → `player`; `ColemanLeader.position` → `rank`.
  `competition: CompetitionCode` field added to all five variants
  (`brownlow`, `all-australian`, `rising-star`, `coleman`, `coaches`).
  `BrownlowVote` adds `polledGames: number | null` (count of games where
  the player polled ≥1 vote, R fitzRoy parity) and `isMedallist: boolean`
  (parsed from R's `" W"` suffix on the medallist's name; suffix stripped
  from `player`. For source data without the suffix the medallist is
  derived from the maximum vote count, with ties honoured). CLI `awards`
  table now uses per-type column dispatch — rows render their actual
  fields rather than empty cells from naming mismatches. (#97)

### Added

- **`localToUtc(timezone, year, month, day, h, m): Result<Date,
  DstGapError>`** — venue-tz-aware local→UTC conversion that
  surfaces DST spring-forward gaps as a Result error instead of
  silently mapping to the wrong instant. Replaces the
  Melbourne-only `melbourneLocalToUtc` helper. (#110)
- **`DstGapError`** — new error class returned by `localToUtc` for
  non-existent local times.
- **`resolveVenueTimezone(canonicalVenue): string | null`** — static
  venue → IANA tz lookup covering all current AFLM/AFLW venues.
- **`ParseDateOptions`** — `parseDate` now accepts a venue or explicit
  timezone alongside the legacy `defaultYear` form. FootyWire passes
  the venue through so non-Melbourne venues produce correct UTC
  instants instead of being 1-3h wrong. (#105)
- **`-o` short alias for `--format`** (kubectl / gh / aws convention).
  (#100)
- **`OPTIONAL_SOURCE_FLAG`** — sibling of the shared `SOURCE_FLAG` for
  commands that need to resolve the default at runtime against a
  per-capability registry (e.g. `stats --by team` defaults to
  `afl-tables`, not `afl-api`). (#87)

### Changed

- `parseDate` now honours explicit `+HH:MM` / `-HH:MM` ISO offsets
  instead of stripping them and silently re-appending `Z`. (#105
  latent variant)
- `Result` namespace value, `OutOfRangeError`, and
  `UnsupportedCompetitionError` now exported from the package.
  Previously declared in `.d.ts` but missing at runtime / unimportable.
  (#106, #107)
- `resolveDefaultSeason` exported for library consumers.
- README now documents all 9 public functions (was 4 of 9), drops the
  stale `fetchMatchResults` reference, and uses `resolveDefaultSeason`
  in examples so the snippets don't go time-stale. (#112)
- TSDoc on `Match.roundCode` / `roundName` corrected — they're
  populated by every source except Squiggle, not "null for scraped
  sources". (#114)
- `team --name X -s Y` (squad mode) now threads `--source` through to
  the underlying call. Previously every squad lookup hit afl-api
  regardless of what the user typed. (#84)
- `team` list now applies `--name`/`--team` filter. Previously silently
  dropped filter flags in bare-list mode. (#115)
- `team --name X -t Y -s Y -r R` lineup output filters table rows to
  the chosen team's players (was showing both teams). (#77)
- `awards --team` / `--limit` now apply post-filters across every
  award type, not just coaches/coleman. (#92)
- `awards --limit` validates: must be a positive integer (was
  silently accepting negatives, zero, and non-numeric). (#93)
- `team -c VFL` and `team -c VFLW` now include the standalone
  (non-AFL-aligned) clubs (Box Hill, Sandringham, Williamstown, …);
  previously stripped by the AFLM-senior allow-list. (#80)
- `team --name X -c VFL --season Y` (squad mode) now resolves
  standalone VFL/VFLW clubs; previously rejected anything not in the
  AFLM senior list. (#81)
- `team -c AFLW` returns 18 clubs (was 14). The 4 AFLW clubs missing
  from the upstream `/teams` endpoint (Essendon, Hawthorn, Sydney
  Swans, Port Adelaide) are now backfilled using their MEN team IDs,
  matching the convention AFLW match data already uses. (#83)
- `--source` description in the shared flag now lists all five valid
  sources; player.ts's outlier inline override removed. (#116)
- Fryzigg coverage capped at 2024 so the dispatcher suggests
  alternatives for current-season requests. (#89)
- AFL Tables 404 messages now friendlier and don't leak the upstream
  URL. (#89)
- CSV format flattens nested objects into dotted scalar columns
  (`q1Home_goals`, `q1Home_behinds`, `q1Home_points`). Previously
  emitted JSON-encoded objects that standard CSV consumers
  couldn't parse. (#95)
- `--match-id` validates upstream provider format
  (`CD_M{digits}`) so malformed IDs error fast instead of producing
  an opaque HTTP 400. (#95)
- `awards --type coleman` now defaults to `--limit 25` at the CLI
  surface when not specified (the Coleman is a top-N leaderboard by
  definition; 500-row dumps were unfriendly). The library API still
  returns the full ranking when `limit` is omitted. (#125)
- `package.json`: added `prerelease` script
  (`typecheck && check && test && build`) so contributors can lock
  dist freshness with one command before tagging. (#126)

### Fixed

- AFL Tables match `date` field now preserves time-of-day; previously
  every match was timestamped at midnight UTC. (#104)
- AFL Tables round-name no longer carries " * see notes Rnd Att: …"
  attendance/footnote suffix; cleaned to "Round 1" / finals labels.
  (#113)
- AFL Tables `Squad` adapter docstring strengthened to clarify that
  `season` is stamped through but the player list is the all-time
  roster. (#88)
- Rising-star scraper recognises FootyWire's "Rd" header (and "Rnd",
  "Round" for older eras); previously matched only "Round" / "Rnd"
  and returned empty for every season tested. (#91)
- Stats schemas accept `null` for `playerJumperNumber` /
  `jumperNumber` so VFL/VFLW and pre-2018 AFLW stats no longer fail
  Zod validation when any player has no assigned number. (#79)
- FootyWire fixture year-rollover documented as a TODO for #111;
  AFLW isn't currently registered to FootyWire so the latent bug
  doesn't fire today.
- AFL Tables player stats: per-match `brownlowVotes` now populated
  correctly from the `BR` column (was hardcoded `null`). (#117)
- `match --source footywire`: completed games now emit
  `homePoints`/`awayPoints`/`margin`/`homeGoals`/`homeBehinds`/`awayGoals`/`awayBehinds`
  instead of `null`. The fixture-list parser detected
  `status: "Complete"` but never extracted the score column. (#122)
- `stats --match <team> -r N` filter now applies on
  `--source footywire` and `--source afl-tables` (previously ignored —
  returned the full round). The match resolver now also returns the
  participating teams; the CLI post-filters non-afl-api results to those
  teams. (#123)
- `awards --type brownlow`: parser now reads from FootyWire's actual
  9-column layout (`Player, Team, V, 3V, 2V, 1V, Played, Polled, V/G`).
  `votes` is read directly from the canonical `V` total; `polledGames`,
  `isMedallist`, and `competition` are populated correctly; the `" W"`
  medallist suffix is stripped from `player`. (#124)
- `player --source fryzigg`: now rejects with a clear error
  (`Unsupported source: fryzigg does not provide squad data`) instead
  of silently returning `[]`. (#126)

## [2.0.0] - 2026-05-06

### Migration guide (1.x → 2.0)

| Old (1.x)                              | New (2.0)                                     |
|----------------------------------------|-----------------------------------------------|
| `fetchMatchResults({...})`             | `fetchMatches({..., status: "Complete"})`     |
| `fetchFixture({...})`                  | `fetchMatches({..., status: "Upcoming"})`     |
| `fetchCoachesVotes({...})`             | `fetchAwards({award: "coaches", ...})`        |
| `MatchResult`, `Fixture` types         | `Match` (with nullable score fields)          |
| `fitzroy matches` / `fitzroy fixture`  | `fitzroy match [--status Complete\|Upcoming]` |
| `fitzroy teams`                        | `fitzroy team`                                |
| `fitzroy squad --team X -s S`          | `fitzroy team --name X -s S`                  |
| `fitzroy lineup -s S -r R`             | `fitzroy team -s S -r R`                      |
| `fitzroy team-stats -s S`              | `fitzroy stats -s S --by team`                |
| `fitzroy player-details ...`           | `fitzroy player ...`                          |
| `fitzroy coaches-votes ...`            | `fitzroy awards --type coaches ...`           |

VFL and VFLW (AFL Reserves men's and women's) are now first-class
competitions via the AFL API from 2021 onwards. Pass `--competition VFL`
or `-c VFLW` to any command.

### Added

- **Source-adapter architecture** — every public API function (`fetchMatches`, `fetchPlayerStats`, `fetchLadder`, `fetchLineup`, `fetchSquad`, `fetchTeamStats`) is now a 3-line registry lookup that delegates to a per-source-per-capability adapter. Adapters live in `src/sources/adapters/` (one file per source) and declare an inline `coverage: Map<CompetitionCode, SeasonRange>` so the public API can validate requests *before* dispatching. Adding a new source becomes "implement the relevant capability interfaces, register in `adapters/index.ts`" with no changes to any `src/api/*` file
- `UnsupportedCompetitionError` and `OutOfRangeError` — structured errors with optional `suggestion` field. The CLI prints the suggestion on its own indented "Try:" line; library callers can read `error.suggestion` programmatically. Per ADR-0001, the public API never silently falls back to another source, but it always names a sensible alternative
- `MatchSource`, `PlayerStatsSource`, `SquadSource`, `LineupSource`, `LadderSource`, `TeamStatsSource` — the per-capability adapter interfaces, plus the `checkCoverage` helper and `SeasonRange` / `CoverageMap` types
- **CLI consolidated to six commands** — every old command is reachable via the new surface:
  - `team` — list teams; with `-s` returns the season's squad; with `-s -r` returns match-day lineups (subsumes `teams`, `squad`, `lineup`)
  - `player` — biographical lookup (replaces `player-details`)
  - `match` — matches in any temporal scope; `--status Upcoming` for fixtures (subsumes `matches`, `fixture`)
  - `stats` — `--by player` (default) or `--by team` (subsumes `team-stats`)
  - `ladder` — unchanged in surface, rewritten with the command builder
  - `awards` — `--type {brownlow,coleman,coaches,all-australian,rising-star}` (subsumes `coaches-votes`)
- `defineFitzroyCommand` (src/cli/command-builder.ts) — internal helper that owns per-command boilerplate (Citty wrapping, validation pipeline, spinner, error boundary, format dispatch)
- `fetchMatches(query: MatchQuery)` — single library function for matches in any temporal scope. Filters by `season`, `round`, `matchId`, `team`, and `status`. Subsumes the old `fetchMatchResults` and `fetchFixture`
- `MatchQuery` interface as the unified shape for all match queries
- `AflApiClient.fetchSeasonMatchItems` accepts an `{ includeUpcoming?: boolean }` option (default: false, preserves the existing CONCLUDED-only filter for callers that want it)
- `fetchAwards({ award: "coleman", season, [limit] })` — Coleman Medal leaderboard, computed from PlayerStats by summing goals per player and ranking
- `fetchAwards({ award: "coaches", season, [round, team, competition] })` — AFLCA coaches votes, folded in from the deprecated `fetchCoachesVotes`
- `rankColemanFromStats` exported as a pure helper for testing and downstream composition
- `AwardQuery` interface widened with optional `competition`, `round`, `team`, `limit` fields (used per-award-type)

### Changed

- **BREAKING:** `CompetitionCode` widened to `"AFLM" | "AFLW" | "VFL" | "VFLW"`. VFL (AFL Reserves men's) and VFLW are first-class via the AFL API from 2021+
- **BREAKING:** `MatchResult` interface renamed to `Match`. Score and quarter-score fields are now nullable so that scheduled matches (formerly `Fixture`) and completed matches share one type. Use `match.status === "Upcoming"` to distinguish
- **BREAKING:** `Fixture` interface removed — replaced by `Match` with nullable score fields
- **BREAKING:** `fetchMatchResults` removed. Use `fetchMatches({ ..., status: "Complete" })` for the same behaviour
- **BREAKING:** `fetchFixture` removed. Use `fetchMatches({ ..., status: "Upcoming" })` for the same behaviour
- **BREAKING:** `fetchCoachesVotes` removed. Use `fetchAwards({ award: "coaches", season, ... })` for the same behaviour
- **BREAKING:** CLI command renames (the eight old commands were deleted):
  - `fitzroy matches` / `fitzroy fixture` → `fitzroy match [--status Complete | --status Upcoming]`
  - `fitzroy teams` → `fitzroy team`
  - `fitzroy squad --team X -s S` → `fitzroy team --name X -s S`
  - `fitzroy lineup -s S -r R` → `fitzroy team -s S -r R`
  - `fitzroy team-stats -s S` → `fitzroy stats -s S --by team`
  - `fitzroy player-details` → `fitzroy player`
  - `fitzroy coaches-votes` → `fitzroy awards --type coaches`
- **BREAKING:** `AflApiClient.fetchTeams` now takes a `CompetitionCode` (e.g. `"AFLM"`) instead of a raw `teamType` string. The teamType lookup is internal
- `AwardType` widened to include `"coleman"` and `"coaches"`. `Award` discriminated union extended with `ColemanLeader` and `CoachesVote`. The `coaches` and `coleman` award fetching wires up in a follow-up
- `transformMatchItems` now produces null score fields for matches without score data (upcoming matches), instead of defaulting to 0

### Fixed

- `AflApiClient.resolveCompetitionId` now uses a hardcoded `(CompetitionCode → competitionId)` map instead of a `code` lookup against `/competitions`. Four entries in the AFL API's competition list share `code="AFL"` (Premiership, Preseason, Origin, Indigenous All Stars) so the lookup was load-bearing on response order

## [1.8.0] - 2026-05-01

### Added

- `--team` / `-t` flag on `lineup` command to filter lineups by team name

## [1.7.0] - 2026-04-05

### Added

- Fryzigg data source (`source: "fryzigg"`) for advanced player statistics via `@jackemcpherson/rds-js` — supports both AFLM (685K+ rows) and AFLW competitions
- `FryziggClient` class for fetching and parsing RDS files from fryziggafl.net
- `transformFryziggPlayerStats()` for mapping fryzigg column-major data to `PlayerStats[]` with season/round filtering

## [1.6.2] - 2026-04-04

### Fixed

- Add `User-Agent` header to all AFL API requests — the CFS endpoints (`api.afl.com.au/cfs/`) return 403 without one, which caused sync failures in Cloudflare Workers where the default User-Agent differs from Node.js

## [1.6.1] - 2026-04-04

### Fixed

- Bind `globalThis.fetch` in all API clients to fix "Illegal invocation" errors in Cloudflare Workers and other edge runtimes that require `fetch` to retain its `this` context

## [1.6.0] - 2026-04-04

### Added

- `attendance`, `weatherTempCelsius`, `weatherType`, `brownlowVotes`, `roundCode` fields on `MatchResult` and `PlayerStats`

## [1.5.0] - 2026-04-04

### Added

- `roundName` field on `MatchResult` — exposes the human-readable round name (e.g. "Round 1", "Qualifying Final") from all data sources
- `position`, `goalEfficiency`, `shotEfficiency`, `interchangeCounts` fields on `PlayerStats` — populated from the AFL API raw response
- `supercoachScore` field on `PlayerStats` — populated from FootyWire's SC column (null for other sources)
- `date`, `homeTeam`, `awayTeam` match context fields on `PlayerStats` — enables cross-source joins without relying on `matchId` format
- `player-details` command now works without `--team` flag — fetches all teams when omitted

### Changed

- `stats` command with `--source afl-api` now returns all available rounds when `-r` is omitted, matching the R package's `fetch_player_stats(season = N)` behaviour

### Fixed

- `stats` command no longer errors on rounds with unplayed matches — gracefully skips matches where the AFL API returns null player stats arrays

## [1.4.2] - 2026-03-30

### Fixed

- AEST date conversion now works reliably across all runtimes — replaced fragile JSON.stringify replacer with direct Date-to-string conversion before serialisation

## [1.4.1] - 2026-03-30

### Fixed

- Game start times in JSON and CSV output now display in AEST/AEDT (e.g., `2026-04-18T19:30:00+10:00`) instead of raw UTC
- Venue normalisation now applied consistently across all routes — previously missing from AFL API fixtures, Squiggle fixtures, FootyWire fixtures/match results, and AFL Tables match results
- Team name normalisation now applied consistently across all routes — previously missing from FootyWire player stats team headers, awards transforms (Brownlow, All-Australian, Rising Star)

## [1.4.0] - 2026-03-30

### Added

- Venue name normalisation (`normaliseVenueName`) — maps sponsor names and historical names to stable canonical forms (e.g., "GMHBA Stadium" → "Kardinia Park", "ENGIE Stadium" → "Sydney Showground")
- Venue normalisation applied automatically to all data sources (AFL API, Squiggle, FootyWire)
- End-to-end comparison test suite (`comparison/test.ts`) validating data parity with the fitzRoy R package across 25 queries on 2024-2025 AFLM data (24/25 passing)

## [1.3.1] - 2026-03-27

### Fixed

- Team name casing in `--match` error messages now normalised — "GWS GIANTS" displays as "GWS Giants" (#53)
- `team-stats --summary` now validates input (case-insensitive) and errors on invalid values like `--summary invalid` (#54)
- `teams --team-type` help text now documents known values (CLUB, REPRESENTATIVE) and errors instead of printing empty results (#55)
- AFL Tables `team-stats` `gamesPlayed` no longer stuck at 0 — team name normalisation fixes the match-results lookup (#45, #51)
- `stats --match-id` team name resolution hardened — static team ID fallback always available, roster names normalised (#42)
- AFLW player stats Zod schema widened to accept boolean stat values, preventing validation failures (#41)

### Changed

- Removed spurious self-dependency (`fitzroy`) from package.json dependencies

## [1.3.0] - 2026-03-27

### Added

- `teams` command without `--competition` now returns both AFLM and AFLW teams (36 total)
- AFL Tables team stats now computes per-game averages when `--summary averages` is used
- Static fallback map for AFL API team IDs, ensuring team names display even when roster fetch fails

### Changed

- Short flag aliases (`-s`, `-r`, `-c`, `-j`, `-t`, `-p`) now work via manual argv resolution (citty v0.2.1 does not resolve them at runtime)
- AFL Tables team stats `gamesPlayed` is now derived from match results (the stats page lacks a GP column)
- AFL Tables stat column keys normalised to match FootyWire convention (`K`, `HB`, `D`, etc.) so default table columns display correctly
- Finals matches from FootyWire and AFL Tables now get distinct round numbers (QF/EF=+1, SF=+2, PF=+3, GF=+4 from last H&A round)
- AFLW default season in the library layer now uses `resolveDefaultSeason()` (previous year) instead of current year

### Fixed

- CLI errors now display clean formatted messages instead of raw stack traces (error boundary wraps each command)
- `--competition AFLW` with non-AFL-API sources now returns a clear error instead of silently returning AFLM data
- AFLW player stats no longer fail Zod validation (schema accepts string-encoded numbers and nullable stat sections)
- `stats --match-id` no longer shows raw team IDs like `CD_T30` when roster fetch fails
- `weightKg` and `heightCm` of `0` from AFL API now map to `null` instead of displaying as zero
- `team-stats --source afl-tables` default table now shows stat columns (K, HB, D, M, G, etc.) instead of only TEAM and GP

## [1.2.0] - 2026-03-27

### Added

- Fuzzy text matching for team names — typos like `Calrton` resolve to `Carlton`, ambiguous input prompts interactive selection via `@clack/prompts`
- `--player` (`-p`) flag on `stats` command for filtering results by player name with fuzzy matching
- `--match` flag on `stats` and `lineup` commands resolves a team name to the specific match in the round (e.g. `--match Carlton -r 1`)
- Short aliases for common CLI flags: `-s` (season), `-r` (round), `-c` (competition), `-t` (team), `-p` (player), `-j` (json)

### Changed

- `squad` command now uses `--team` (`-t`) flag instead of `--team-id`
- `player-details` command now uses `--team` (`-t`) flag instead of a positional argument
- API requests are now batched (max 5 concurrent) to avoid overwhelming upstream APIs
- Concurrent token refresh requests are deduplicated to prevent thundering herd on the AFL API auth endpoint

### Fixed

- Unbounded `Promise.all()` in fixture, player stats, and lineup fetching could trigger rate limits or socket exhaustion
- Multiple concurrent requests could each independently refresh the auth token, wasting requests

## [1.1.1] - 2026-03-27

### Fixed

- CLI now validates `--season`, `--round`, `--format`, `--source`, and `--competition` args with clear error messages instead of passing NaN or invalid values to APIs (#31, #23, #21)
- CLI errors no longer show raw stack traces — all errors are caught and formatted before citty's internal handler (#23)
- `--competition INVALID` on `teams` command now rejects with valid options instead of silently stamping the invalid value (#21)
- `--team-type` on `teams` command shows guidance when no results are found (#22)
- `squad --team-id` now accepts team names and abbreviations (e.g. `Carlton`, `CARL`) in addition to numeric IDs (#27)
- `player-details --competition AFLW` now defaults to the correct season year (previous year) instead of the current year (#30)
- `stats --match-id` now resolves team names instead of showing raw API IDs (e.g. `CD_T120`) (#24)
- AFLW player stats no longer fail validation — Zod schema now accepts `null` stat fields returned by the AFLW API (#25)
- FootyWire date parsing no longer returns Jan 1 for all matches — extended parser handles year-less time-bearing strings like `"Thu 13 Mar 7:30pm"` (#20)
- FootyWire DOB strings (e.g. `"7 Oct 1995"`) are now normalised to ISO format (`1995-10-07`) (#20)
- Table output displays dates in AEST instead of raw UTC ISO strings (#20)
- `lineup` table and CSV output now shows individual players (flattened per-player rows) instead of just match metadata (#26)
- `team-stats` default table output now includes key stat columns (K, HB, D, M, G, B, T, I50) instead of only Team and GP (#28)
- AFL Tables `team-stats` parser now extracts `gamesPlayed` from GP/GM column when present instead of always returning 0 (#29)

## [1.1.0] - 2026-03-27

### Added

- **Squiggle data source** — new `SquiggleClient` for the Squiggle API, supporting match results, fixture, and ladder standings via `fetchMatchResults`, `fetchFixture`, and `fetchLadder` with `source: "squiggle"`
- **`fetchTeamStats`** — team aggregate statistics from FootyWire (2010+) and AFL Tables (1965+), with totals/averages summary types
- **`fetchPlayerDetails`** — player biographical data (DOB, height, weight, draft info, games played) from AFL API, FootyWire, and AFL Tables
- **`fetchAwards`** — Brownlow Medal votes, All-Australian selections, and Rising Star nominations from FootyWire
- **`fetchCoachesVotes`** — AFLCA coaches votes scraped from aflcoaches.com.au (2006+ AFLM, 2018+ AFLW)
- **Computed ladder from AFL Tables** — `fetchLadder` with `source: "afl-tables"` computes standings from historical match results
- **FootyWire fixture support** — `fetchFixture` with `source: "footywire"` scrapes scheduled and completed matches
- **FootyWire player stats** — `fetchPlayerStats` with `source: "footywire"` scrapes per-match basic and advanced player statistics (2010+)
- **AFL Tables player stats** — `fetchPlayerStats` with `source: "afl-tables"` scrapes individual game pages for per-match player statistics (1965+)
- CLI commands: `team-stats`, `player-details`, `coaches-votes`
- Squiggle Zod validation schemas (`SquiggleGameSchema`, `SquiggleStandingSchema`, etc.)
- `AFL_SENIOR_TEAMS` set of the 18 current senior AFL club names
- Shared parsing utilities (`safeInt`, `parseIntOr0`, `parseFloatOr0`) in `src/lib/parse-utils.ts`
- "Lions" alias for Brisbane Lions in team name normalisation

### Fixed

- AFL Tables season page parser now correctly extracts round numbers (was returning 0 for all matches due to `border` attribute check skipping round header tables)
- AFL Tables team stats URL corrected to summary page (`{year}s.html`) which has actual team-level aggregates
- AFL Tables player list URL corrected to all-time page (`stats/alltime/{slug}.html`) with proper column parsing for `Games (W-D-L)` format
- FootyWire team stats URL corrected from removed `ft_team_statistics` to `ft_team_rankings` (matching R package)
- FootyWire team stats parser rewritten to use 11th table with column indices matching the R package
- FootyWire player details URL corrected from `th-` (team history) to `tp-` (team profile) with parser updated for `No, Name, Games, Age, DOB, Height, Origin, Position` column layout
- FootyWire player list parser no longer matches the settings form table instead of the player data table
- `score` field in `MatchItemSchema` changed from `.optional()` to `.nullish()` to handle null scores from AFL API
- Ladder and player stats round filtering now works correctly for AFL Tables source

### Changed

- `DataSource` union type expanded: `"squiggle"` added alongside existing `"afl-api" | "footywire" | "afl-tables"`
- `fetchTeams` now filters to the 18 senior AFL clubs using `AFL_SENIOR_TEAMS`

### Removed

- `scripts/smoke-test.ts` — replaced by comprehensive CLI testing

## [1.0.2] - 2026-03-26

### Fixed

- CLI commands crashed with `ReferenceError: fetchTeams is not defined` — bunup also tree-shook CLI subcommand imports; switched CLI build to esbuild
- Duplicate shebang in CLI bundle caused `SyntaxError: Invalid or unexpected token`

## [1.0.1] - 2026-03-26

### Fixed

- Library bundle was empty due to bun bundler tree-shaking barrel re-exports — switched library build to esbuild
- Removed accidental self-dependency (`fitzroy` listed in its own dependencies)

## [1.0.0] - 2026-03-26

### Added

- CLI (`fitzroy`) exposing all library functions as terminal commands: `matches`, `stats`, `fixture`, `ladder`, `lineup`, `squad`, `teams`
- Three output formats: table (default, human-readable), JSON (`--json`), CSV (`--csv`)
- Interactive spinner during data fetching with summary line after load
- `--full` flag to show all columns in table output
- Automatic JSON output when stdout is piped (non-TTY)
- Coloured error messages for all known error types (no stack traces)
- Build pipeline via bunup producing ESM library bundle, CLI bundle, and type declarations
- Standalone compiled binaries for macOS ARM64, Linux x64, and Linux ARM64
- npm packaging with conditional exports, type declarations, and provenance attestation
- GitHub Actions release workflow for automated npm publish and binary distribution

### Changed

- **Breaking:** Package renamed from `fitzroy-ts` to `fitzroy`
- CLI version now injected from package.json at build time (no longer hardcoded)

## [0.1.2] - 2026-03-26

### Added

- 5 new fields on `SquadPlayer`: `draftYear`, `draftPosition`, `draftType`, `debutYear`, `recruitedFrom` — extracted from AFL API squad endpoint

### Removed

- `supercoachPoints` and `brownlowVotes` from `PlayerStats` type — no data source provides these fields

## [0.1.1] - 2026-03-26

### Added

- `fetchLadder` now fully implemented via AFL API `/compseasons/{id}/ladders` endpoint
- 34 new fields on `PlayerStats`: 8 base stats (goalAccuracy, marksInside50, tacklesInside50, shotsAtGoal, scoreInvolvements, totalPossessions, timeOnGroundPercentage, ratingPoints) and 26 extendedStats (pressureActs, effectiveDisposals, etc.)
- 6 new fields on `MatchResult`: venueState, venueTimezone, homeRushedBehinds, awayRushedBehinds, homeMinutesInFront, awayMinutesInFront
- `form` field on `LadderEntry`
- Ladder transform (`transformLadderEntries`) and Zod schemas (`LadderResponseSchema`, `LadderEntryRawSchema`)

### Fixed

- AFL API full-season fetch now returns all rounds (was limited to ~10 due to missing `pageSize` on rounds endpoint)
- Finals round queries (e.g. round 25) no longer fail
- `fetchLineup` now returns `Lineup[]` for all matches in a round (was returning only the first match)
- Player stats `team` field now contains the resolved team name instead of raw API team ID (e.g. "Carlton" instead of "CD_T30")
- Player stats `timeOnGroundPercentage` now correctly extracted (was always `null` due to wrong schema level)

### Changed

- **Breaking:** `fetchLineup` return type changed from `Result<Lineup, Error>` to `Result<Lineup[], Error>`
- **Breaking:** Canonical team names now match AFL API convention (e.g. `Sydney Swans`, `Geelong Cats`, `GWS Giants`). Short names and all-caps API variants are normalised to title-cased AFL API names.

## [0.1.0] - 2026-03-26

### Added

- Public API functions: `fetchMatchResults`, `fetchPlayerStats`, `fetchFixture`, `fetchLineup`, `fetchLadder`, `fetchTeams`, `fetchSquad`
- AFL API client (`AflApiClient`) with automatic token-based authentication and retry on 401
- AFL API metadata resolution for competitions, seasons, and rounds
- FootyWire HTML scraper for match results
- AFL Tables HTML scraper for historical season results (1897-present)
- Fryzigg source stub (unsupported — RDS binary format only)
- Zod validation schemas for all AFL API response shapes
- Transform functions for match results, player stats, and lineups
- Team name normalisation (`normaliseTeamName`) covering all 18 current teams, abbreviations, and historical names
- Date utilities for AFL API, FootyWire, and AFL Tables date formats with AEST/AEDT-aware formatting
- Result type (`Result<T, E>`) for typed error handling
- Custom error classes: `AflApiError`, `ScrapeError`, `ValidationError`, `UnsupportedSourceError`
- Domain types for match results, player stats, fixtures, lineups, ladders, teams, and squads
- Multi-source routing in `fetchMatchResults` (AFL API, FootyWire, AFL Tables)
- CI workflow with typecheck, lint, and test checks
- Dependabot configuration for npm and GitHub Actions
