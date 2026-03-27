# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
