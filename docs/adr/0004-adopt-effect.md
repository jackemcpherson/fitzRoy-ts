# ADR-0004: Adopt Effect and the Version 2 TypeScript Standards

This decision moves fitzRoy to Effect, `effect/Schema`, and the Vite+
toolchain in a breaking version 7 release.

| Property | Value           |
| -------- | --------------- |
| Status   | Accepted        |
| Date     | 13 October 2026 |

## Context

The published TypeScript standards changed in October 2026. Version 2 makes
Effect the core of every TypeScript project:

- Effect carries expected failures and dependencies.
- `effect/Schema` validates every boundary.
- Vite+ runs formatting, linting, type checks, tests, and builds.

fitzRoy version 6 follows the previous standards. It uses a custom `Result`
union, Zod schemas, Biome, `tsc`, Vitest, and `bunup`.

The project has one consumer, so a compatibility layer has no value.

## Decision

Release version 7.0.0 with these changes:

1. Every public data function returns an `Effect`.
2. Every expected failure is a tagged error class with the current name and
   fields.
3. Each data source is a service with a live layer. `FitzroyLive` provides all
   of them.
4. `effect/Schema` replaces Zod, including the `fitzroy/schemas` subpath.
5. Vite+ replaces Biome, `tsc`, direct Vitest use, and `bunup`.
6. `@effect/vitest` test layers replace module mocks and global `fetch` stubs.

Remove `Result`, `ok`, `err`, and the exported client classes.

### Effect Version

Pin Effect 4. The published standards use Effect 3 names. Use the Effect 4
equivalents in this table:

| Standard (Effect 3)           | fitzRoy (Effect 4)                        |
| ----------------------------- | ----------------------------------------- |
| `Context.Tag`                 | `Context.Service`                         |
| `Schema.decodeUnknown`        | `Schema.decodeUnknownEffect`              |
| `Either`                      | `Result` from `effect`                    |
| `@effect/platform` HTTP       | `effect/http` (`FetchHttpClient`)         |
| `.passthrough()` (Zod)        | `Schema.StructWithRest` with a record     |

Update the published standards to the Effect 4 names in a separate change.

### Library Exceptions

The standards describe Cloudflare Workers. fitzRoy is an npm library and a
Node command-line tool, so these exceptions apply:

- The library core uses Web Standard APIs only. `tsconfig.portable.json`
  continues to enforce this rule.
- Node APIs such as `process` are permitted only in `src/cli.ts` and
  `src/cli/`.
- The Cloudflare delivery rules do not apply. The release workflow publishes
  to npm with provenance and builds Node single executable binaries with
  `vp pack`.
- Tests run in the Node environment instead of Miniflare.
- Citty remains the argument parser. Commands run their effects through one
  managed runtime.

## Rationale

One consumer makes a direct cut cheaper than a dual API. A shim would keep
the `Result` union that the standards remove.

Services and layers replace the current fetch injection options. Tests then
supply fixtures through layers instead of global stubs and module mocks.

## Consequences

- Version 7 breaks every public call site. `docs/migration-v7.md` describes
  each change.
- Golden tests under `test/golden/` record version 6 data, errors, and command
  output before the migration. Later changes must keep these snapshots.
- ADR-0001, ADR-0002, and ADR-0003 still apply. The shared batching helper
  keeps each call site's batch size and delay.
- Request behaviour does not change: timeouts, the optional 5xx retry, and
  AFL API token caching stay the same.

## Review Trigger

Reconsider this decision if fitzRoy gains consumers who cannot adopt Effect.
