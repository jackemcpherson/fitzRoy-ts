# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
