# fitzroy

[![CI](https://github.com/jackemcpherson/fitzRoy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/jackemcpherson/fitzRoy-ts/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/fitzroy)](https://www.npmjs.com/package/fitzroy)

TypeScript library and CLI for AFL data — match results, player stats, fixtures, ladders, lineups, squads, and teams.

A port of the [fitzRoy R package](https://github.com/jimmyday12/fitzRoy).

## Data Sources

- **AFL API** — official AFL data covering AFLM (2012+), AFLW (2017+), VFL and VFLW (2021+). Default for matches, stats, squads, lineups, ladders.
- **FootyWire** — scraped AFLM match results, fixtures, player stats, team stats, awards
- **AFL Tables** — AFLM historical results (1897+) and player stats (~1965+)
- **Squiggle** — AFLM match results and ladder
- **Fryzigg** — advanced AFLM and AFLW player stats
- **AFL Coaches** — AFLCA coaches votes

## Install

```bash
npm install fitzroy
```

## Library Usage

```typescript
import { fetchMatches, fetchPlayerStats, fetchLadder, fetchAwards } from "fitzroy";

// Matches for a season
const matches = await fetchMatches({ source: "afl-api", season: 2025, competition: "AFLM" });

// Only completed matches (the old fetchMatchResults behaviour)
const completed = await fetchMatches({ source: "afl-api", season: 2025, status: "Complete" });

// Upcoming fixtures
const upcoming = await fetchMatches({ source: "afl-api", season: 2025, status: "Upcoming" });

// Player stats for a specific round
const stats = await fetchPlayerStats({ source: "afl-api", season: 2025, round: 1 });

// Ladder standings
const ladder = await fetchLadder({ source: "afl-api", season: 2025 });

// Coleman Medal leaderboard (computed from PlayerStats)
const coleman = await fetchAwards({ award: "coleman", season: 2025, limit: 10 });
```

All functions return `Result<T, Error>` — check `result.success` before accessing `result.data`.

## CLI

```bash
# Install globally
npm install -g fitzroy

# Six top-level commands, all sharing a uniform "drill in by adding flags" UX:

# Matches (subsumes the old `matches` and `fixture` commands)
fitzroy match --season 2025 --round 1
fitzroy match --season 2025 --status Upcoming

# Player or team stats (subsumes the old `team-stats` command)
fitzroy stats --season 2025 --round 1                 # per-player rows
fitzroy stats --season 2025 --by team                 # team aggregates

# Ladder standings
fitzroy ladder --season 2025

# Team identity (subsumes the old `teams`, `squad`, `lineup` commands)
fitzroy team                                          # list all teams
fitzroy team --name Carlton -s 2025                   # team's squad for season
fitzroy team -s 2025 -r 3                             # all match-day lineups for round 3

# Player biography (replaces `player-details`)
fitzroy player --team Carlton -s 2025

# Awards (subsumes `coaches-votes`; adds Coleman, Brownlow, etc.)
fitzroy awards --type brownlow -s 2024
fitzroy awards --type coleman  -s 2025 --limit 10
fitzroy awards --type coaches  -s 2024 --round 3

# Output formats
fitzroy match --season 2025 --json    # JSON (default when piped)
fitzroy match --season 2025 --csv     # CSV with headers
fitzroy match --season 2025 --full    # All columns in table view
```

Pass `--competition VFL` (or AFLW, VFLW) to any command to scope to that competition.

Run `fitzroy --help` for all commands and options.

## Contributing

1. Clone the repo
2. Install dependencies: `bun install`
3. Run quality checks: `npm run typecheck && npm run check && npm run test`

## License

MIT
