# fitzRoy R Package Parity Notes

This document tracks known differences between the [fitzRoy R package](https://github.com/jimmyday12/fitzRoy) (v1.7.0) and this TypeScript implementation.

## Team Name Normalisation

fitzRoy-ts normalises all team names to the AFL API's canonical names across all data sources. The R package passes through source-native naming, which varies between sources.

| AFL API canonical | R (AFL Tables) | R (FootyWire) | fitzRoy-ts |
|---|---|---|---|
| Adelaide Crows | Adelaide | Adelaide | Adelaide Crows |
| Brisbane Lions | Brisbane Lions | Brisbane | Brisbane Lions |
| Geelong Cats | Geelong | Geelong | Geelong Cats |
| Gold Coast SUNS | Gold Coast | Gold Coast | Gold Coast Suns |
| GWS GIANTS | GWS | GWS | GWS Giants |
| Sydney Swans | Sydney | Sydney | Sydney Swans |
| West Coast Eagles | West Coast | West Coast | West Coast Eagles |
| Western Bulldogs | Footscray | Western Bulldogs | Western Bulldogs |

fitzRoy-ts uses the AFL API's match/ladder naming as canonical, with title-cased mascots (e.g. "GWS Giants" not "GWS GIANTS"). All sources (AFL Tables, FootyWire) normalise to these names. Use `normaliseTeamName()` to convert any variant to the canonical form.

## Data Sources Not Yet Implemented

| Source | R Functions | Status in TS |
|---|---|---|
| Squiggle | `fetch_results`, `fetch_ladder` | Not implemented |
| Fryzigg | `fetch_player_stats` | Stub (unsupported) |
| FootyWire player stats | `fetch_player_stats(source="footywire")` | Not implemented |
| AFL Tables player stats | `fetch_player_stats(source="afltables")` | Not implemented |

## Structural Differences

- **R returns flat tibbles**, TS returns typed objects. For example, R's lineup data is a flat dataframe with one row per player across all matches; TS returns an array of `Lineup` objects, each containing `homePlayers[]` and `awayPlayers[]`.
- **R returns raw API field names** (e.g. `match.homeTeam.name`, `homeTeamScore.matchScore.totalScore`). TS normalises to flat domain types (e.g. `homeTeam`, `homePoints`).
