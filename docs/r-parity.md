# R Package Parity Notes

This document records intentional differences between fitzRoy and the
[fitzRoy R package](https://github.com/jimmyday12/fitzRoy) version 1.7.0.

## Team Name Normalisation

fitzRoy normalises every source to AFL API canonical club names. The R package
retains source-specific names.

| AFL API Canonical | R AFL Tables   | R FootyWire      | fitzRoy           |
| ----------------- | -------------- | ---------------- | ----------------- |
| Adelaide Crows    | Adelaide       | Adelaide         | Adelaide Crows    |
| Brisbane Lions    | Brisbane Lions | Brisbane         | Brisbane Lions    |
| Geelong Cats      | Geelong        | Geelong          | Geelong Cats      |
| Gold Coast SUNS   | Gold Coast     | Gold Coast       | Gold Coast Suns   |
| GWS GIANTS        | GWS            | GWS              | GWS Giants        |
| Sydney Swans      | Sydney         | Sydney           | Sydney Swans      |
| West Coast Eagles | West Coast     | West Coast       | West Coast Eagles |
| Western Bulldogs  | Footscray      | Western Bulldogs | Western Bulldogs  |

Use `normaliseTeamName()` to convert source variants. fitzRoy uses title case
for club mascots, such as `GWS Giants`.

## Limited Data Coverage

Fryzigg provides static AFLM and AFLW player-stat snapshots. The adapter applies
explicit coverage caps from the latest reviewed upstream dump. See
`src/sources/adapters/fryzigg.ts` for the current boundaries.

## Structural Differences

R returns flat tibbles. fitzRoy returns typed objects. R lineup data contains
one row per player, while fitzRoy returns `Lineup` objects with `homePlayers`
and `awayPlayers` arrays.

R also retains nested upstream field names. fitzRoy maps them into flat domain
fields, such as `homeTeam` and `homePoints`.

## References

- [fitzRoy R package](https://github.com/jimmyday12/fitzRoy)
