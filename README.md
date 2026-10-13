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
  and awards.
- AFL Tables: AFLM historical results from 1897 and statistics from about 1965.
- Match coaches: AFL Tables supplies credited-coach records for AFLM from 1990.
  FootyWire extraction remains internal. Captured match headings must establish
  coverage before any FootyWire season-wide support.
- Squiggle: AFLM match results and ladders.
- Fryzigg: advanced AFLM and AFLW player-stat snapshots.
- AFL Coaches: AFLCA coaches votes.

## Install

```bash
npm install fitzroy
```

Upgrading to version 7? Read the [version 7 migration guide](docs/migration-v7.md).
For earlier changes, see the [version 6 migration guide](docs/migration-v6.md).

## Library Usage

Version 7 uses [Effect](https://effect.website/). Each `fetch*` function
returns an `Effect` that succeeds with data or fails with a tagged error. Run it
with `FitzroyLive`, which provides the source services and the HTTP policy:

```typescript
import { Effect } from "effect";
import { FitzroyLive, fetchMatches, resolveDefaultSeason } from "fitzroy";

const season = resolveDefaultSeason("AFLM");

const program = fetchMatches({ source: "afl-api", season }).pipe(
  Effect.map((matches) => `${matches.length} matches in ${season}`),
  Effect.catchTag("AflApiError", (error) => Effect.succeed(`AFL API failed: ${error.message}`)),
);

console.log(await Effect.runPromise(program.pipe(Effect.provide(FitzroyLive))));
```

Errors are `Schema.TaggedError` classes such as `AflApiError`, `ScrapeError`,
`OutOfRangeError`, and `UnsupportedSourceError`. Handle them with
`Effect.catchTag` or `Match.tag`. Coverage errors carry a `suggestion` that
names a source with coverage.

Provide `FitzroyLive` once per program. A single runtime shares one AFL API
token across every call. To change the request policy, provide
`SourceHttpConfig`:

```typescript
import { Effect } from "effect";
import { FitzroyLive, SourceHttpConfig, fetchLadder } from "fitzroy";

const ladder = fetchLadder({ source: "afl-api", season: 2025 }).pipe(
  Effect.provide(FitzroyLive),
  Effect.provideService(SourceHttpConfig, { timeout: "10 seconds", retry5xx: true }),
);
```

In tests, replace `FetchHttpClient.Fetch` from `effect/http` with a
fixture-backed `fetch`, or provide a stub for one source service such as
`AflApi` with `Layer.succeed`.

### Public API

| Function             | Query type           | Succeeds with         | Requires                                    |
| -------------------- | -------------------- | --------------------- | ------------------------------------------- |
| `fetchMatches`       | `MatchQuery`         | `Match[]`             | `SourceRegistry`                            |
| `fetchMatchCoaches`  | `MatchCoachesQuery`  | `MatchCoachesResult`  | `SourceRegistry`                            |
| `fetchPlayerStats`   | `PlayerStatsQuery`   | `SeasonPlayerStats`   | `SourceRegistry`                            |
| `fetchTeamStats`     | `TeamStatsQuery`     | `TeamStatsEntry[]`    | `SourceRegistry`                            |
| `fetchLadder`        | `LadderQuery`        | `Ladder`              | `SourceRegistry`                            |
| `fetchTeams`         | `TeamQuery`          | `Team[]`              | `AflApi`                                    |
| `fetchSquad`         | `SquadQuery`         | `Squad`               | `SourceRegistry`                            |
| `fetchLineup`        | `LineupQuery`        | `Lineup[]`            | `SourceRegistry`                            |
| `fetchPlayerDetails` | `PlayerDetailsQuery` | `PlayerDetailsResult` | `SourceRegistry`, `AflApi`                  |
| `fetchAwards`        | `AwardQuery`         | `AwardResult`         | `SourceRegistry`, `FootyWire`, `AflCoaches` |
| `fetchSeasons`       | `CompetitionCode`    | `CompetitionSeason[]` | `AflApi`                                    |

Every function fails with a `SourceError`. `FitzroyLive` provides every
requirement.

Examples for each, inside `Effect.gen` (using `resolveDefaultSeason` so the
snippets stay stable year-on-year):

```typescript
import { Effect } from "effect";
import {
  FitzroyLive,
  fetchAwards,
  fetchLadder,
  fetchLineup,
  fetchMatchCoaches,
  fetchMatches,
  fetchPlayerDetails,
  fetchPlayerStats,
  fetchSquad,
  fetchTeamStats,
  fetchTeams,
  resolveDefaultSeason,
} from "fitzroy";

const season = resolveDefaultSeason("AFLM");

const program = Effect.gen(function* () {
  // Coach assignments use AFL Tables by default; partial page failures remain
  // visible in `completeness` instead of dropping successful assignments.
  yield* fetchMatchCoaches({ season, team: "Carlton" });

  // All matches for a season, only completed, or upcoming fixtures
  yield* fetchMatches({ source: "afl-api", season });
  yield* fetchMatches({ source: "afl-api", season, status: "Complete" });
  yield* fetchMatches({ source: "afl-api", season, status: "Upcoming" });

  // Player and team stats for round 1
  yield* fetchPlayerStats({ source: "afl-api", season, round: 1 });
  yield* fetchTeamStats({ source: "afl-tables", season, competition: "AFLM" });

  // Ladder
  yield* fetchLadder({ source: "afl-api", season });

  // Team identity
  yield* fetchTeams({ competition: "AFLM" });
  yield* fetchSquad({ source: "afl-api", season, team: "Carlton" });
  yield* fetchLineup({ source: "afl-api", season, round: 1 });
  yield* fetchPlayerDetails({ source: "afl-api", season, team: "Carlton" });

  // Awards
  yield* fetchAwards({ award: "coleman", season, limit: 10 });
  yield* fetchAwards({ award: "brownlow", season });
});

await Effect.runPromise(program.pipe(Effect.provide(FitzroyLive)));
```

The package root also exports an Effect schema for every domain model, such as
`MatchSchema` and `LadderSchema`. Use them to decode or encode stored output.

Partial-result envelopes keep successful rows and identify missing data. Check
`failedMatchIds`, `failedTeams`, or `failedRounds` before you treat a result as
complete. Check `Squad.scope` and `PlayerDetailsResult.scope` before you treat a
scraped roster as season-specific.

### Wire Schemas (`fitzroy/schemas`)

The `fitzroy/schemas` subpath exports the raw AFL API and Squiggle response
schemas (Effect Schema) for consumers who need to validate wire-level payloads
directly.
The package publishes this subpath, but its contents track upstream API shapes.
Schemas may change at minor versions when the upstream changes. Depend on it
only if you are deliberately coupling to the raw wire format.

```typescript
import { Result, Schema } from "effect";
import { MatchItemListSchema } from "fitzroy/schemas";

// Validate a raw AFL API round response
const result = Schema.decodeUnknownResult(MatchItemListSchema)(rawJson);
if (Result.isFailure(result)) {
  console.error("Upstream shape changed:", result.failure.message);
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

Pass `--competition VFL` to select a competition when the command and source
cover it. Coverage errors identify unsupported combinations.

Run `fitzroy --help` for all commands and options.

Read the [CLI guide](docs/cli.md) for modes, validation rules, source limits,
output envelopes, and partial-failure behaviour.

## Contributing

1. Clone the repository.
2. Install dependencies with `bun install`. This command also installs the
   pre-commit hook that runs `vp staged`.
3. Use Bun as the only contributor package manager. `bun.lock` is the sole lock
   file, and a pre-install guard rejects `npm install`.
4. Run quality checks with `npx vp check && npx vp test`.

## License

[MIT](LICENSE)

## Explicit Competition Seasons in Version 6

Use `fetchSeasons(competition)` to discover canonical season keys, calendar
years, display names and provider season IDs. Ordinary seasons accept either
`2026` or `"2026"`. AFLW's two 2022 seasons require `"2022-S6"` or `"2022-S7"`.
A bare AFLW `2022` fails with `AmbiguousSeasonError` and its `validSelectors`.
Competition remains separate from the season key.

```typescript
import { fetchMatches, fetchSeasons } from "fitzroy";

const seasons = yield* fetchSeasons("AFLW");
const matches = yield* fetchMatches({
  source: "afl-api",
  competition: "AFLW",
  season: "2022-S7",
});
```

The `seasons` CLI command exposes discovery. Match-ID shortcuts validate the
selected competition and season. Returned records retain the numeric calendar
year and add `seasonKey`. Use that key when joining or grouping season data.
