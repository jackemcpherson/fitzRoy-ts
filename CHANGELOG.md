# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
