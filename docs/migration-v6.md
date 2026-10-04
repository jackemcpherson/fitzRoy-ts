# Migrating to Fitzroy 6

Version 6 makes competition seasons explicit. A calendar year alone cannot
identify AFLW's two 2022 seasons.

## Select a competition season

Keep numeric years for unambiguous seasons. Replace AFLW `season: 2022` with
`season: "2022-S6"` or `season: "2022-S7"`. Season six contains 75 matches;
season seven contains 99. Competition remains a separate query field.

```typescript
import { fetchMatches, fetchSeasons } from "fitzroy";

const discovery = await fetchSeasons("AFLW");
const results = await fetchMatches({
  source: "afl-api",
  competition: "AFLW",
  season: "2022-S7",
});
```

Discovery returns `seasonKey`, `year`, `displayName`, `competition` and
`providerSeasonId`. Treat provider IDs as provider identities, not internal
database IDs. Use `seasonKey` to group season-scoped results; the numeric
`season` field continues to describe the calendar year.

A bare AFLW `2022` request returns `AmbiguousSeasonError`. Its `validSelectors`
property lists the accepted keys. Default season resolution preserves the
selected competition season instead of reducing it to a calendar year.
If the provider cannot establish chronology, the default resolver throws its
provider error. Supply an explicit season to operate without that lookup.
`fetchPlayerDetails` returns that failure through its `Result` contract.

The CLI accepts the same selectors:

```shell
fitzroy seasons --competition AFLW --json
fitzroy match --competition AFLW --season 2022-S7 --json
```

## Validate match shortcuts

Statistics and lineup queries that supply a match ID now verify that the ID
belongs to the selected competition and season. A mismatched ID returns an
error instead of carrying caller-supplied season metadata. When supplied, round
selection must agree too.

## Handle partial statistics

AFL API season statistics now retain successful matches when another match
fails. Check `failedMatchIds` before describing a response as complete. A
single-match fetch failure still returns an error result.

AFLW coaches votes for the split 2022 seasons remain unsupported because the
provider's year-based interface has no verified selector for each season.
Fitzroy does not assign those votes to a season by inference.

## Refresh lineup role flags

`INT` means interchange and no longer sets `isSubstitute`. Only an explicit
`SUB` position sets that flag. `EMG` and `EMERG` remain emergencies. Consumers
that store lineup flags should refresh affected historical rosters through a
reviewed repair; issued prediction snapshots must remain unchanged.
