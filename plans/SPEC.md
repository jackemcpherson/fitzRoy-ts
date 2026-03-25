# fitzRoy-ts - Product Requirements Document

## Overview

fitzRoy-ts is a TypeScript port of the [fitzRoy R package](https://github.com/jimmyday12/fitzRoy), providing programmatic access to AFL (Australian Football League) data from multiple sources. The library exposes typed functions for fetching match results, player statistics, fixtures, lineups, and ladder standings across AFLM and AFLW competitions. It targets Cloudflare Workers as the primary runtime but uses only Web Standard APIs to remain portable.

## Goals

- Achieve functional parity with fitzRoy v1.7.x — every public `fetch_*` function has a TypeScript equivalent
- Provide fully typed return values with Zod-validated API boundaries
- Run in Cloudflare Workers (V8 runtime) with zero Node.js dependencies
- Serve as a standalone, reusable library that can be consumed by downstream packages (e.g., MCP servers, ETL pipelines)

## Non-Goals

- Data storage or persistence layer (D1, Postgres, etc.) — consumers handle their own storage
- MCP server implementation — separate package consumes this library
- ETL orchestration, scheduling, or cron triggers
- Embedding generation or vector search
- PAV calculation — downstream concern
- Web UI or API server (Hono routes) — this is a library, not an application
- Mobile or browser runtime support (Workers + Node.js/Bun are the targets)

## User Stories Overview

The primary user is a TypeScript developer building AFL data applications (analytics dashboards, MCP servers, bots). They need to:

1. Fetch match results for a season/round from the AFL API
2. Fetch per-player match statistics
3. Fetch team rosters and squads
4. Fetch fixture/schedule data
5. Look up competition, season, and round metadata
6. Fall back to FootyWire when AFL API data is delayed
7. Access historical data via AFL Tables (HTML scraping)
8. Normalise team names across sources
9. Handle AFL API authentication transparently

## Requirements

### Functional Requirements

#### AFL API Client (Primary Source — 2020+)

- FR-001: Authenticate with the AFL API token endpoint (`WMCTok`) and cache the token for the session, refreshing on 401 responses
- FR-002: Resolve competition IDs from competition code (AFLM, AFLW, etc.) via `/afl/v2/competitions`
- FR-003: Resolve season IDs from a year + competition via `/afl/v2/competitions/{compId}/compseasons`
- FR-004: Resolve round IDs (and round metadata) from a season via `/afl/v2/compseasons/{seasonId}/rounds`
- FR-005: Fetch match results for a round via `/cfs/afl/matchItems/round/{roundId}`, flattening nested `periodScore` arrays into per-quarter columns
- FR-006: Fetch detailed match information (single match) via `/cfs/afl/matchItem/{matchProviderId}`
- FR-007: Fetch per-player statistics for a match via `/cfs/afl/playerStats/match/{matchProviderId}`, stripping `playerStats.` and `playerName.` prefixes
- FR-008: Fetch match lineup/roster via `/cfs/afl/matchRoster/full/{matchProviderId}`
- FR-009: Fetch team lists with filtering by team type via `/afl/v2/teams`
- FR-010: Fetch squad/roster for a team + season via `/afl/v2/squads`
- FR-011: Support fetching results and stats for an entire season by iterating over all completed rounds
- FR-012: Support both AFLM and AFLW competitions through the competition code parameter

#### FootyWire Client (Fallback Source)

- FR-013: Fetch season match results by scraping the FootyWire match list page (`ft_match_list?year={year}`)
- FR-014: Fetch per-match player statistics by scraping the FootyWire match statistics page (`ft_match_statistics?mid={matchId}`)
- FR-015: Handle Cloudflare protection on FootyWire with appropriate request headers

#### AFL Tables Client (Historical Source)

- FR-016: Fetch historical season results by scraping AFL Tables season pages (`afltables.com/afl/seas/{year}.html`)
- FR-017: Fetch player biographical details (height, weight, DOB) by scraping AFL Tables player pages
- FR-018: Support seasons from 1897 to present for results data

#### Fryzigg Client (Advanced Stats Source)

- FR-019: Attempt to discover and use JSON/CSV endpoints on `fryziggafl.net` for advanced player statistics
- FR-020: If no JSON/CSV endpoints exist, document Fryzigg functions as unsupported in v1 with clear explanation (R-specific RDS binary format)
- FR-021: If JSON/CSV endpoints are found, fetch and validate advanced player statistics (pressure acts, metres gained, contest stats, effective disposals, etc.)

#### Data Transformation

- FR-022: Flatten nested AFL API responses (period scores, player stat prefixes) into flat typed objects
- FR-023: Normalise team names across all sources to canonical names (e.g., "GWS" / "Greater Western Sydney" / "GWS Giants" all map to a single canonical form)
- FR-024: Provide a team name mapping that covers all historical and current team names, including renamed teams (e.g., "Footscray" -> "Western Bulldogs")
- FR-025: Parse and normalise dates from all sources, handling UTC strings from the AFL API and various formats from scraped sources

#### Public API Surface

- FR-026: Export a top-level function for each fitzRoy equivalent: `fetchMatchResults`, `fetchPlayerStats`, `fetchFixture`, `fetchLineup`, `fetchLadder`, `fetchSquad`, `fetchTeams`, etc.
- FR-027: Each public function accepts a `source` parameter to select the data source (AFL API, FootyWire, AFL Tables) — mirroring fitzRoy's `source` argument
- FR-028: Each public function accepts season year and optional round number parameters at minimum
- FR-029: Return fully typed interfaces for all data (not `any` or raw JSON)
- FR-030: Export all public types and Zod schemas for consumers to reuse

### Non-Functional Requirements

- NFR-001: Use only Web Standard APIs (`fetch`, `Request`, `Response`, `URL`, `crypto`) — no Node.js built-ins, no Bun-specific APIs
- NFR-002: TypeScript strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noExplicitAny` (via Biome)
- NFR-003: All external data (API responses, scraped HTML) validated through Zod schemas before entering typed domain
- NFR-004: Zero runtime dependencies beyond `zod` and `cheerio` — `hono`, `drizzle-orm` are not dependencies of the library
- NFR-005: All public APIs return `Promise<Result<T>>` using the Result pattern for expected failures, with custom error classes for exceptional failures
- NFR-006: Bundle size should remain reasonable for Workers deployment (target < 500KB including cheerio)
- NFR-007: All code passes `biome check`, `tsc --noEmit`, and `vitest` before merge
- NFR-008: Test coverage for all transform functions using fixture-based tests (snapshot API responses, no live API calls in tests)

## Technical Considerations

### Architecture

The library follows the style guide's "pure core, effectful shell" principle:

```
src/
  index.ts              # Public API re-exports
  types.ts              # All shared interfaces and type aliases
  sources/
    afl-api.ts          # AFL Official API client (effectful shell)
    footywire.ts        # FootyWire scraper (effectful shell)
    afl-tables.ts       # AFL Tables scraper (effectful shell)
    fryzigg.ts          # Fryzigg client or stub (effectful shell)
  transforms/
    match-results.ts    # Flatten + normalise match data (pure core)
    player-stats.ts     # Flatten + normalise player stats (pure core)
    lineup.ts           # Normalise lineup data (pure core)
  lib/
    validation.ts       # Zod schemas for all external data
    team-mapping.ts     # Canonical team name resolution
    date-utils.ts       # Date parsing and AEST/AEDT handling
    errors.ts           # Custom error classes (AflApiError, ScrapeError, etc.)
    result.ts           # Result<T, E> type and helpers
  api/
    match-results.ts    # fetchMatchResults() — orchestrates source selection
    player-stats.ts     # fetchPlayerStats() — orchestrates source selection
    fixture.ts          # fetchFixture()
    lineup.ts           # fetchLineup()
    ladder.ts           # fetchLadder()
    teams.ts            # fetchTeams(), fetchSquad()

test/
  sources/
    afl-api.test.ts
    footywire.test.ts
    afl-tables.test.ts
  transforms/
    match-results.test.ts
    player-stats.test.ts
  api/
    match-results.test.ts
    player-stats.test.ts
  fixtures/
    afl-api-round-1.json
    afl-api-player-stats.json
    footywire-match-list.html
    afl-tables-season.html
```

Key decisions:
- **`sources/`** owns HTTP calls and raw response handling — one file per data source
- **`transforms/`** owns pure data transformation — no I/O, easily testable
- **`api/`** owns the public-facing functions — selects source, calls transforms, returns typed results
- **`lib/`** owns shared utilities — validation schemas, team mapping, error types
- **`index.ts`** re-exports only the public API surface

### Dependencies

| Dependency | Purpose | Required |
|-----------|---------|----------|
| `zod` | Runtime validation of API responses and scraped data | Yes |
| `cheerio` | HTML parsing for FootyWire and AFL Tables scraping | Yes |
| `typescript` | Type checking (dev) | Dev |
| `@biomejs/biome` | Lint + format (dev) | Dev |
| `vitest` | Test runner (dev) | Dev |

### Integration Points

- **Consumers** import from the package entry point and call typed async functions
- **AFL Official API** — see detailed notes below
- **FootyWire** — HTML scraping of `footywire.com` match list and statistics pages
- **AFL Tables** — HTML scraping of `afltables.com` season and player pages
- **Fryzigg** — TBD pending endpoint discovery; may be stubbed as unsupported

### AFL API Details (verified 2026-03-26)

The AFL API has two distinct base URLs with different auth requirements:

| Base URL | Auth Required | Purpose |
|----------|--------------|---------|
| `https://aflapi.afl.com.au/afl/v2/` | No | Public metadata: competitions, compseasons, rounds, teams |
| `https://api.afl.com.au/cfs/afl/` | WMCTok token | Match data: matchItems, playerStats, matchRoster |

**Token endpoint:** `POST https://api.afl.com.au/cfs/afl/WMCTok` with `Content-Length: 0` header. Returns `{ "token": "<hex>", "disclaimer": "..." }` — **not** an OAuth response. No `expires_in` is provided; assume 30-minute TTL. The R fitzRoy package uses this token as a cookie for `/cfs/` endpoints.

**Key API response shapes (divergences from initial assumptions):**
- All entity `id` fields are **numbers**, not strings (competitions, compseasons, rounds, teams)
- Compseason list key is **`compSeasons`** (camelCase), not `compseasons`
- The AFLM competition uses code **`"AFL"`** in the API, not `"AFLM"` — the client maps `"AFLM"` → `"AFL"` internally
- Compseason entries have `name`, `shortName`, `currentRoundNumber` — no `year` field (year is extracted from `name`)
- Round numbers start at **0** (Opening Round) for seasons that have one

**R fitzRoy package reference:** Source at `github.com/jimmyday12/fitzRoy/blob/main/R/helpers-afl.R`. Key functions: `get_afl_cookie()`, `find_comp_id()`, `find_season_id()`, `find_round_id()`. The R package does **not** send auth headers for `aflapi.afl.com.au` metadata endpoints.

## Success Criteria

- [ ] Every public `fetch_*` function in fitzRoy v1.7.x has a TypeScript equivalent or is explicitly documented as unsupported (with reason)
- [ ] All functions return typed data validated by Zod schemas — no `any` in the public API
- [ ] Library runs in Cloudflare Workers without errors (verified via Miniflare/wrangler dev)
- [ ] Test suite covers all transform functions and Zod schemas with fixture-based tests
- [ ] All quality checks pass: `tsc --noEmit`, `biome check .`, `vitest`
- [ ] README documents the full public API with usage examples for each function
- [ ] Team name normalisation handles all known variants across all sources

## Open Questions

- **Fryzigg JSON/CSV endpoints**: Do `fryziggafl.net/api/` endpoints exist and return usable data? Needs investigation before implementation. If not, Fryzigg functions will be stubbed as unsupported in v1.
- **FootyWire Cloudflare protection**: How aggressive is the protection? May need to test and adjust headers. If scraping is blocked, FootyWire becomes unsupported.
- **fitzRoy function inventory**: A complete audit of all public `fetch_*` and helper functions in fitzRoy v1.7.x is needed during implementation to ensure nothing is missed. The endpoint map covers the major ones but may not be exhaustive.
- **Package publishing**: Should the library be published to npm from v1, or kept as a local/git dependency initially?

## References

- [fitzRoy R package source code](https://github.com/jimmyday12/fitzRoy)
- [fitzRoy companion data repo](https://github.com/jimmyday12/fitzroy_data)
- AFL API endpoint map (provided in project context)
- TypeScript style guide (`TYPESCRIPT_STYLE_GUIDE.md`)
