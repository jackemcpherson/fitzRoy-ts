# Fitzroy

[![CI](https://github.com/jackemcpherson/fitzRoy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/jackemcpherson/fitzRoy-ts/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/fitzroy)](https://www.npmjs.com/package/fitzroy)

TypeScript library and CLI for AFL data - matches, stats, ladders, teams,
players, and awards.

A port of the [fitzRoy R package](https://github.com/jimmyday12/fitzRoy).

## Data Sources

- AFL API: official AFL data covering AFLM (2012+), AFLW (2017+), VFL and VFLW
  (2021+). Default for matches, stats, squads, lineups, ladders.
- FootyWire: scraped AFLM match results, fixtures, player stats, team stats,
  awards
- AFL Tables: AFLM historical results (1897+) and player stats (~1965+)
- Squiggle: AFLM match results and ladder
- Fryzigg: advanced AFLM and AFLW player stats
- AFL Coaches: AFLCA coaches votes

## Install

```bash
npm install fitzroy
```

Upgrading from 3.0.x? See [docs/migration-v3.md](docs/migration-v3.md) for a
per-release breakdown of what changed and a checklist of behavioural changes to
verify during upgrade.

## Library Usage

All public functions return `Result<T, E>` - check `result.success` before
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

The composition functions on the `Result` namespace help chain calls without the
`if (!r.success) return r` boilerplate accumulating at every call site:

```typescript
const summary = Result.map(r, (matches) => matches.length);
```

### Public API

| Function             | Query type           | Returns                           |
| -------------------- | -------------------- | --------------------------------- |
| `fetchMatches`       | `MatchQuery`         | `Result<Match[], Error>`          |
| `fetchPlayerStats`   | `PlayerStatsQuery`   | `Result<PlayerStats[], Error>`    |
| `fetchTeamStats`     | `TeamStatsQuery`     | `Result<TeamStatsEntry[], Error>` |
| `fetchLadder`        | `LadderQuery`        | `Result<Ladder, Error>`           |
| `fetchTeams`         | `TeamQuery`          | `Result<Team[], Error>`           |
| `fetchSquad`         | `SquadQuery`         | `Result<Squad, Error>`            |
| `fetchLineup`        | `LineupQuery`        | `Result<Lineup[], Error>`         |
| `fetchPlayerDetails` | `PlayerDetailsQuery` | `Result<PlayerDetails[], Error>`  |
| `fetchAwards`        | `AwardQuery`         | `Result<Award[], Error>`          |

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
await fetchTeamStats({ source: "afl-tables", season, round: 1 }); // team stats: afl-tables or footywire (afl-api has no team-stats endpoint)

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

### Wire Schemas (`fitzroy/schemas`)

The `fitzroy/schemas` subpath exports the raw AFL API and Squiggle response
schemas (Zod) for consumers who need to validate wire-level payloads directly.
The package publishes this subpath, but its contents track upstream API shapes.
Schemas may change at minor versions when the upstream changes. Depend on it
only if you are deliberately coupling to the raw wire format.

```typescript
import { MatchItemListSchema } from "fitzroy/schemas";

// Validate a raw AFL API round response
const result = MatchItemListSchema.safeParse(rawJson);
if (!result.success) {
  console.error("Upstream shape changed:", result.error.issues);
}
```

Available exports include `MatchItemListSchema`, `PlayerStatsListSchema`,
`CompetitionListSchema`, `SquiggleGameSchema`, and the full suite of AFL API CFS
response schemas. See `src/schemas.ts` for the complete list.

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

Pass `--competition VFL` (or AFLW, VFLW) to any command to scope to that
competition.

Run `fitzroy --help` for all commands and options.

## Contributing

1. Clone the repository.
2. Install dependencies with `bun install`. This command also installs the
   pre-commit hook that runs `biome check --staged`.
3. Use Bun as the only contributor package manager. `bun.lock` is the sole lock
   file, and a pre-install guard rejects `npm install`.
4. Run quality checks with `npm run typecheck && npm run check && npm run test`.

## License

[MIT](LICENSE)
