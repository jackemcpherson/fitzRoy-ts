# Migrating to Fitzroy 7

Version 7 moves the library to Effect. Every data function returns an `Effect`,
every expected failure is a tagged error, and every data source is a service.
Data, error messages, and CLI output do not change.

## Run Effects Instead of Awaiting Results

Each `fetch*` function now returns an `Effect` instead of a `Promise` of a
`Result`. Provide `FitzroyLive` and run the effect at the edge of your program.

Version 6 code:

```typescript
const result = await fetchMatches({ source: "afl-api", season: 2025 });
if (!result.success) throw result.error;
console.log(result.data.length);
```

Version 7 code:

```typescript
import { Effect } from "effect";
import { FitzroyLive, fetchMatches } from "fitzroy";

const matches = await Effect.runPromise(
  fetchMatches({ source: "afl-api", season: 2025 }).pipe(Effect.provide(FitzroyLive)),
);
console.log(matches.length);
```

Inside `Effect.gen`, use `yield*` to read a value. Compose several calls in one
program and provide `FitzroyLive` once. One runtime then shares a single AFL API
access token.

## Replace the Result Helpers

The package no longer exports `Result`, `ok`, `err`, `Ok`, or `Err`. Use Effect
functions instead:

| Version 6                     | Version 7                                   |
| ----------------------------- | ------------------------------------------- |
| `Result.map(r, f)`            | `Effect.map(effect, f)`                     |
| `Result.flatMapAsync(r, f)`   | `Effect.flatMap(effect, f)`                 |
| `if (!r.success) return r`    | `yield* effect` inside `Effect.gen`         |
| `r.error instanceof X`        | `Effect.catchTag("X", handler)`             |

`localToUtc` is synchronous and returns Effect's `Result` from the `effect`
package. Check it with `Result.isSuccess` and read `result.success`.

## Handle Tagged Errors

Every error class is now a `Schema.TaggedError` with the same name, message, and
fields. Each instance also has a `_tag` equal to its class name, so
`Effect.catchTag("OutOfRangeError", ...)` and `Match.tag` work directly.
`instanceof` checks still work.

`ScrapeError` gains an optional `statusCode`. The private AFL Coaches HTTP error
subclass is gone. A 404 from AFL Coaches is a `ScrapeError` with
`statusCode: 404`. `IncompleteDataError` is new: `fetchPlayerDetails` fails with
it when every team request fails. Version 7 also removes the
`aflwUnsupportedError` helper.

## Use Services Instead of Client Classes

Version 7 removes the client classes. Each source is now a service with a live layer:

| Version 6 class    | Version 7 service and layer       |
| ------------------ | --------------------------------- |
| `AflApiClient`     | `AflApi`, `AflApiLive`            |
| `FootyWireClient`  | `FootyWire`, `FootyWireLive`      |
| `AflTablesClient`  | `AflTables`, `AflTablesLive`      |
| `SquiggleClient`   | `Squiggle`, `SquiggleLive`        |
| `FryziggClient`    | `Fryzigg`, `FryziggLive`          |
| `AflCoachesClient` | `AflCoaches`, `AflCoachesLive`    |

Service methods keep their names and parameters and return effects. Use
`AflApi.use((aflApi) => aflApi.fetchTeams("AFLM"))` to call one directly.

Version 7 also removes the constructor options `fetchFn`, `timeoutMs`,
`signal`, and `retry5xx`:

- Set the timeout and the single 5xx retry with `SourceHttpConfig`.
- Replace `fetchFn` by providing `FetchHttpClient.Fetch` from `effect/http`.
- Cancel a request by interrupting the effect that runs it.
- Set the Fryzigg checksum override with `FryziggConfig`.

## Decode with Effect Schemas

The `fitzroy/schemas` subpath now exports Effect schemas instead of Zod schemas.
Replace `MatchItemListSchema.safeParse(json)` with
`Schema.decodeUnknownResult(MatchItemListSchema)(json)`. Unknown upstream keys
still pass through.

The package root also exports a schema for each domain model, such as
`MatchSchema`, `LadderSchema`, and `PlayerStatsSchema`. The type names do not
change.

## Season Resolution

`resolveDefaultSeasonForCompetition` returns an `Effect` that fails with the
provider error. It no longer throws. `fetchSeasons` returns an `Effect`.

## Upgrade Checklist

1. Add `effect` 4 to your dependencies.
2. Wrap each data call in an `Effect` program and provide `FitzroyLive` once.
3. Replace `Result` checks with `yield*`, `Effect.catchTag`, or `Effect.result`.
4. Replace client classes with services, and constructor options with
   `SourceHttpConfig`, `FetchHttpClient.Fetch`, or `FryziggConfig`.
5. Replace Zod calls on `fitzroy/schemas` with Effect Schema decoding.
6. Remove any `catch` around `resolveDefaultSeasonForCompetition`.

## Documentation Provenance

[ADR-0004](adr/0004-adopt-effect.md) records the decision. Golden tests in
`test/golden/` compare the data, errors, and CLI output of version 7 with
version 6.
