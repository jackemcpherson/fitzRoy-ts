# Command-Line Interface

The Fitzroy command-line interface (CLI) has six commands. Each command writes
data to standard output. Warnings and errors use standard error.

Run the general help or command help before you automate a query:

```shell
fitzroy --help
fitzroy stats --help
```

## Output Formats

Use `--json`, `--csv`, or `--format table|json|csv` to select a format.
`--json` has the highest priority. `--csv` has the next priority.

A non-interactive command defaults to JSON. An interactive terminal defaults
to a table. Use an explicit format in scripts.

JSON preserves completeness envelopes. Tables and CSV contain only row data.
Warnings never appear in standard output.

| Command mode   | JSON output                       | Table and CSV rows    |
| -------------- | --------------------------------- | --------------------- |
| Player stats   | `{ stats, failedMatchIds }`       | `stats`               |
| Player details | `{ players, failedTeams, scope }` | `players`             |
| Awards         | `{ awards, failedRounds }`        | `awards`              |
| Ladder         | Full `Ladder` object              | `entries`             |
| Team list      | `{ mode: "list", teams }`         | `teams`               |
| Team squad     | `{ mode: "squad", squad }`        | `squad.players`       |
| Team lineup    | `{ mode: "lineup", lineups }`     | Flattened player rows |

Use `--full` to include all available columns in a table.

## Match Command

The `match` command returns match rows for a season.

```shell
fitzroy match --season 2025
fitzroy match --season 2025 --round 3
fitzroy match --season 2025 --status Complete
fitzroy match --season 2025 --source footywire --id FW_11193
```

The `--team` flag accepts a name or abbreviation. It does not accept a numeric
team identifier. The `--id` value must match the selected source.

| Source       | Match identifier form      |
| ------------ | -------------------------- |
| `afl-api`    | `CD_M` followed by digits  |
| `footywire`  | `FW_...` or `FW_SYNTH_...` |
| `afl-tables` | `AT_...` or `AT_SYNTH_...` |
| `squiggle`   | `SQ_...`                   |

## Stats Command

Player statistics are the default mode:

```shell
fitzroy stats --season 2025
fitzroy stats --season 2025 --round 3
fitzroy stats --season 2025 --player "Patrick Cripps"
fitzroy stats --season 2025 --match Carlton --round 3
```

`--match` needs `--round`. The CLI resolves the selected match through the AFL
schedule. Scraped sources then use the resolved participant names.

Use `--id` for a provider identifier. Fryzigg match identifiers contain digits
only. Do not combine `--match` and `--id`.

Player mode rejects `--summary`. JSON includes both successful rows and failed
match identifiers. A failed game does not corrupt JSON or CSV output.

Team statistics use `--by team`:

```shell
fitzroy stats --season 2025 --by team --source afl-tables
fitzroy stats --season 2025 --by team --team Carlton
fitzroy stats --season 2025 --by team --summary averages
```

Team mode accepts season, source, competition, team, and summary filters. It
rejects round, match, match identifier, and player filters.

Team-stat sources currently cover AFLM only. Unsupported competitions fail
before network access. The `--team` flag filters the returned team rows.

AFL Tables derives games played from season match results. Totals can contain
`gamesPlayed: null` when that enrichment fails. The CLI prints a warning.
An averages request fails when any denominator is missing or non-positive.

## Ladder Command

The `ladder` command returns one season snapshot:

```shell
fitzroy ladder --season 2025
fitzroy ladder --season 2025 --round 12
fitzroy ladder --season 2025 --source afl-tables
```

JSON preserves the snapshot metadata and its `entries`. Tables and CSV contain
the entries only.

## Team Command

The `team` command selects one of three modes from its flags.

### Team List

Omit season and round to list teams:

```shell
fitzroy team
fitzroy team --team 30
fitzroy team --name Carlton
```

Team-list filters can use a name, abbreviation, or identifier. Only `afl-api`
provides the team list.

### Squad

Supply a season and team to request a squad:

```shell
fitzroy team --season 2025 --name Carlton
fitzroy team --season 2025 --team Carlton --source footywire
```

A squad request requires `--name` or `--team`. Do not supply both flags.
AFL API returns `scope: "season"`. FootyWire and AFL Tables return
`scope: "all-time"` and retain the season as query context.

### Lineup

Supply season and round to request match-day lineups:

```shell
fitzroy team --season 2025 --round 3
fitzroy team --season 2025 --round 3 --team blues
fitzroy team --season 2025 --round 3 --match Carlton
fitzroy team --season 2025 --round 3 --match-id CD_M20250140301
```

The lineup team filter resolves aliases and ignores case. Use only one of
`--match` and `--match-id`. AFL API is the only lineup source.

Round requires season. Match selection requires both season and round. A season
without a team or round is incomplete and fails before network access.

## Player Command

The `player` command returns biographical player rows:

```shell
fitzroy player --season 2025 --team Carlton
fitzroy player --season 2025 --source footywire
```

Omit `--team` to request all senior teams. Successful team requests remain in
the result when another team fails. JSON lists failed canonical team names in
`failedTeams`. The command fails when every team request fails.

The response `scope` describes the player list. AFL API data uses `season`.
FootyWire and AFL Tables data uses `all-time`. The CLI warns about all-time data
on standard error.

Numeric identifiers are not valid on this name-only path. Use a team name or
abbreviation.

## Awards Command

Select an award type and season:

```shell
fitzroy awards --type brownlow --season 2024
fitzroy awards --type coleman --season 2025 --limit 10
fitzroy awards --type coaches --season 2025
fitzroy awards --type coaches --season 2025 --round 3
```

Only coaches votes accept `--round`. The CLI rejects an invalid round filter
before it resolves a team. `--limit` applies after a team filter for every
award type.

Season coaches requests keep votes from successful rounds. JSON lists network,
non-404 HTTP, and parse failures in `failedRounds`. A 404 or valid empty page
means that the round is unavailable and does not enter the failure list.

## Source Limits

Fitzroy never changes sources without a request. A coverage error can suggest
another source, but the caller must select that source.

| Source        | Main coverage and limits                           |
| ------------- | -------------------------------------------------- |
| `afl-api`     | AFLM 2012+, AFLW 2017+, VFL and VFLW 2021+         |
| `footywire`   | AFLM only, approximately 2010+                     |
| `afl-tables`  | AFLM results 1897+, statistics approximately 1965+ |
| `squiggle`    | AFLM matches and ladders 2012+                     |
| `fryzigg`     | Snapshot player statistics with fixed season caps  |
| `afl-coaches` | AFLM 2006+ and AFLW 2018+ coaches votes            |

Each capability has a separate coverage map. A source can support matches and
reject team statistics. Read the error message for the exact operation limit.

## Failure Behaviour

Validation errors occur before a data request when the CLI has enough local
information. These errors include invalid modes, source-specific identifiers,
and numeric values on name-only paths.

Expected library failures use a `Result` error. The CLI prints the error on
standard error and exits with status 1. It does not print a stack trace.

Partial results exit successfully because they contain usable rows. The CLI
prints one completeness warning on standard error. Machine-readable standard
output remains valid JSON or CSV.
