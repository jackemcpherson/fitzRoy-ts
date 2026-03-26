# fitzRoy-ts

A TypeScript port of the [fitzRoy R package](https://github.com/jimmyday12/fitzRoy), providing programmatic access to AFL (Australian Football League) data from multiple sources.

## Data Sources

- **AFL API** — official AFL/AFLW match results, player stats, fixtures, lineups, and teams
- **FootyWire** — scraped match results
- **AFL Tables** — historical season results (1897–present)

## Install

```bash
npm install fitzroy-ts
```

## Usage

```typescript
import { fetchMatchResults, fetchPlayerStats } from "fitzroy-ts";

const results = await fetchMatchResults({ season: 2025, source: "AFL" });
const stats = await fetchPlayerStats({ season: 2025, round: 1 });
```

## Contributing

1. Clone the repo
2. Install dependencies: `bun install`
3. Run quality checks: `npm run typecheck && npm run check && npm run test`
