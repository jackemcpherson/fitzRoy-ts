# fitzroy

[![CI](https://github.com/jackemcpherson/fitzRoy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/jackemcpherson/fitzRoy-ts/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/fitzroy)](https://www.npmjs.com/package/fitzroy)

TypeScript library and CLI for AFL data — matches, stats, ladders, teams, players, and awards.

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

All public functions return `Result<T, E>` — check `result.success` before
accessing `result.data` (or `result.error` on failure):

```typescript
import { fetchMatches, resolveDefaultSeason, Result } from "fitzroy";

const season = resolveDefaultSeason("AFLM");
const r = await fetchMatches({ source: "afl-api", season });

if (!r.success) {
  console.error(r.error);
  process.exit(1);
}
console.log(`${r.data.length} matches in ${season}`);
```

The composition combinators on the `Result` namespace help chain calls without
the `if (!r.success) return r` boilerplate accumulating at every call site:

```typescript
const summary = Result.map(r, (matches) => matches.length);
```

### Public API

| Function | Query type | Returns |
|---|---|---|
| `fetchMatches` | `MatchQuery` | `Result<Match[], Error>` |
| `fetchPlayerStats` | `PlayerStatsQuery` | `Result<PlayerStats[], Error>` |
| `fetchTeamStats` | `TeamStatsQuery` | `Result<TeamStatsEntry[], Error>` |
| `fetchLadder` | `LadderQuery` | `Result<Ladder, Error>` |
| `fetchTeams` | `TeamQuery` | `Result<Team[], Error>` |
| `fetchSquad` | `SquadQuery` | `Result<Squad, Error>` |
| `fetchLineup` | `LineupQuery` | `Result<Lineup[], Error>` |
| `fetchPlayerDetails` | `PlayerDetailsQuery` | `Result<PlayerDetails[], Error>` |
| `fetchAwards` | `AwardQuery` | `Result<Award[], Error>` |

Examples for each (using `resolveDefaultSeason` so the snippets stay stable
year-on-year):

```typescript
import {
  fetchAwards,
  fetchLadder,
  fetchLineup,
  fetchMatches,
  fetchPlayerDetails,
  fetchPlayerStats,
  fetchSquad,
  fetchTeamStats,
  fetchTeams,
  resolveDefaultSeason,
} from "fitzroy";

const season = resolveDefaultSeason("AFLM");

// All matches for a season
await fetchMatches({ source: "afl-api", season });
// Only completed
await fetchMatches({ source: "afl-api", season, status: "Complete" });
// Upcoming fixtures
await fetchMatches({ source: "afl-api", season, status: "Upcoming" });

// Player and team stats for round 1
await fetchPlayerStats({ source: "afl-api", season, round: 1 });
await fetchTeamStats({ source: "afl-api", season, round: 1 });

// Ladder
await fetchLadder({ source: "afl-api", season });

// Team identity
await fetchTeams({ source: "afl-api", competition: "AFLM" });
await fetchSquad({ source: "afl-api", season, team: "Carlton" });
await fetchLineup({ source: "afl-api", season, round: 1 });
await fetchPlayerDetails({ source: "afl-api", season, team: "Carlton" });

// Awards
await fetchAwards({ award: "coleman", season, limit: 10 });
await fetchAwards({ award: "brownlow", season });
```

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
