# fitzroy

[![CI](https://github.com/jackemcpherson/fitzRoy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/jackemcpherson/fitzRoy-ts/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/fitzroy)](https://www.npmjs.com/package/fitzroy)

TypeScript library and CLI for AFL data — match results, player stats, fixtures, ladders, lineups, squads, and teams.

A port of the [fitzRoy R package](https://github.com/jimmyday12/fitzRoy).

## Data Sources

- **AFL API** — official AFL/AFLW match results, player stats, fixtures, lineups, ladders, and teams
- **FootyWire** — scraped match results
- **AFL Tables** — historical season results (1897-present)

## Install

```bash
npm install fitzroy
```

## Library Usage

```typescript
import { fetchMatchResults, fetchPlayerStats, fetchLadder } from "fitzroy";

// Match results for a season
const matches = await fetchMatchResults({ source: "afl-api", season: 2025, competition: "AFLM" });

// Player stats for a specific round
const stats = await fetchPlayerStats({ source: "afl-api", season: 2025, round: 1 });

// Ladder standings
const ladder = await fetchLadder({ source: "afl-api", season: 2025 });
```

All functions return `Result<T, Error>` — check `result.success` before accessing `result.data`.

## CLI

```bash
# Install globally
npm install -g fitzroy

# Match results
fitzroy matches --season 2025 --round 1

# Player stats
fitzroy stats --season 2025 --round 1

# Ladder
fitzroy ladder --season 2025

# Fixture
fitzroy fixture --season 2025

# Output formats
fitzroy matches --season 2025 --json    # JSON (default when piped)
fitzroy matches --season 2025 --csv     # CSV with headers
fitzroy matches --season 2025 --full    # All columns in table view
```

Run `fitzroy --help` for all commands and options.

## Contributing

1. Clone the repo
2. Install dependencies: `bun install`
3. Run quality checks: `npm run typecheck && npm run check && npm run test`

## License

MIT
