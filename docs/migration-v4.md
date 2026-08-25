# Version 4 Migration Guide

Version 4 makes incomplete and unscoped data visible. Update consumers before
you change the dependency range to `^4.0.0`.

## Player Statistics

`fetchPlayerStats` already returned a season envelope in version 3. Version 4
applies an exact `matchId` filter to both fields after every source adapter.

```typescript
const result = await fetchPlayerStats({
  source: "footywire",
  season: 2025,
  matchId: "FW_11193",
});

if (result.success) {
  useStats(result.data.stats);
  recordMissingMatches(result.data.failedMatchIds);
}
```

The player-stats CLI now preserves this envelope in JSON.

Version 3 JSON:

```json
[
  { "matchId": "FW_11193", "displayName": "Player One" }
]
```

Version 4 JSON:

```json
{
  "stats": [
    { "matchId": "FW_11193", "displayName": "Player One" }
  ],
  "failedMatchIds": ["FW_11194"]
}
```

CSV and table output still contain stat rows only.

## Player Details

`fetchPlayerDetails` now returns `PlayerDetailsResult`.

Version 3:

```typescript
const result: Result<PlayerDetails[], Error> = await fetchPlayerDetails(query);
if (result.success) usePlayers(result.data);
```

Version 4:

```typescript
const result: Result<PlayerDetailsResult, Error> = await fetchPlayerDetails(query);
if (result.success) {
  usePlayers(result.data.players);
  recordMissingTeams(result.data.failedTeams);
  checkScope(result.data.scope);
}
```

An all-team request retains every successful team. `failedTeams` contains the
canonical names of failed squad requests in request order. The function still
returns an error when every team fails.

Player CLI JSON changed from an array to this object:

```json
{
  "players": [],
  "failedTeams": ["Richmond"],
  "scope": "season"
}
```

CSV and table output still contain player rows only.

## Squad Scope

Every `Squad` now has a required `scope` field.

```typescript
type SquadScope = "season" | "all-time";
```

AFL API squads use `season`. FootyWire and AFL Tables use `all-time`. Scraper
adapters retain the requested `season` as query context.

Check `scope` before you label players as members of a historical season.

## Awards

`fetchAwards` now returns `AwardResult`.

Version 3:

```typescript
const result: Result<Award[], Error> = await fetchAwards(query);
if (result.success) useAwards(result.data);
```

Version 4:

```typescript
const result: Result<AwardResult, Error> = await fetchAwards(query);
if (result.success) {
  useAwards(result.data.awards);
  recordMissingRounds(result.data.failedRounds);
}
```

Non-coaches awards and single-round coaches requests use an empty failure list.
A season coaches request records network, non-404 HTTP, and parse failures.
It treats 404 and valid empty pages as unavailable.

Awards CLI JSON changed from an array to this object:

```json
{
  "awards": [],
  "failedRounds": [7]
}
```

CSV and table output still contain award rows only.

## Coaches Client

`AflCoachesClient.fetchSeasonVotes` now returns `CoachesVotesResult`.

```typescript
const result = await client.fetchSeasonVotes(2025, "AFLM");
if (result.success) {
  useVotes(result.data.votes);
  recordMissingRounds(result.data.failedRounds);
}
```

The client keeps successful rounds when another round fails. It returns an
error when no round provides a vote.

## Team Statistics

`TeamStatsQuery` now accepts `competition`. It defaults to `AFLM`.

```typescript
await fetchTeamStats({
  source: "afl-tables",
  season: 2025,
  competition: "AFLM",
});
```

Coverage dispatch rejects unsupported competitions before network access.
Current team-stat sources support AFLM only.

`TeamStatsEntry.gamesPlayed` changed from `number` to `number | null`. AFL
Tables uses match results to enrich a missing value. Totals retain `null` when
enrichment fails. Averages return an error for a missing or non-positive value.

## CLI Validation

Version 4 rejects flag combinations that version 3 could ignore.

- Player stats reject `--summary`.
- Team stats reject round, match, match identifier, and player filters.
- Team `--season` needs a team or round.
- Team `--round` needs a season.
- Match selection needs season and round.
- `--name` and `--team` cannot appear together.
- `--match` and its identifier flag cannot appear together.
- Non-coaches awards reject `--round` before team resolution.
- Name-only team paths reject numeric identifiers.

Team-list filters and the identifier-aware resolver still accept numeric team
identifiers. Team statistics now apply `--team` as a real row filter.

Match identifiers must match their source:

| Source       | Required form              |
| ------------ | -------------------------- |
| `afl-api`    | `CD_M...`                  |
| `footywire`  | `FW_...` or `FW_SYNTH_...` |
| `afl-tables` | `AT_...` or `AT_SYNTH_...` |
| `squiggle`   | `SQ_...`                   |
| `fryzigg`    | Digits only                |

## Coleman Ranking

Coleman queries now rank the full home-and-away field. They then apply the team
filter and limit. A filtered request no longer loses eligible players because
an unfiltered leader consumed the limit.

## Upgrade Checklist

1. Change every `fetchPlayerDetails` success path to read `data.players`.
2. Change every `fetchAwards` success path to read `data.awards`.
3. Change direct coaches-client code to read `data.votes`.
4. Handle all completeness lists before you publish derived data.
5. Handle both values of `SquadScope`.
6. Handle `TeamStatsEntry.gamesPlayed === null`.
7. Update CLI JSON decoders for the three envelopes.
8. Run automation with explicit output formats and valid flag modes.

## Documentation Provenance

The version 4 verification used product-description commit `5eafd8c`. Automated
tests and this guide replace the temporary verification documents from that
repository.
