# TypeScript Style Guide

Fitzroy follows the published
[TypeScript Development Style Guide](https://jackemcpherson.com/docs/typescript-style-guide.md).
This page lists only the project decisions that differ from that guide.

---

## Library Exceptions

The published guide describes Cloudflare Workers. Fitzroy is an npm library and
a Node command-line tool, so these exceptions apply.
[ADR-0004](adr/0004-adopt-effect.md) records the reasons.

- The library core uses Web Standard APIs only. `tsconfig.portable.json`
  enforces this rule without Node types.
- Node APIs such as `process` belong only in `src/cli.ts` and `src/cli/`.
- The Cloudflare delivery rules do not apply. The release workflow publishes
  to npm with provenance and builds binaries with `bun build --compile`.
- Tests run in the Node environment instead of Miniflare.
- Citty remains the argument parser. Commands run their effects through one
  managed runtime in `src/cli/runtime.ts`.
- `src/types.ts` holds the domain schemas, and `src/lib/validation/` holds the
  upstream wire schemas.

## Effect Version

Fitzroy uses Effect 4. Where the published guide uses Effect 3 names, use the
Effect 4 equivalents:

| Published guide              | Fitzroy                                  |
| ---------------------------- | ---------------------------------------- |
| `Context.Tag`                | `Context.Service`                        |
| `Schema.decodeUnknown`       | `Schema.decodeUnknownEffect`             |
| `Either`                     | `Result` from `effect`                   |
| `@effect/platform` HTTP      | `effect/http` `FetchHttpClient.Fetch`    |
| `import ... from "vite"`     | `import ... from "vite-plus"`            |

## Project Patterns

- Each data source is a `Context.Service` with a `*Live` layer over
  `SourceHttp` (`src/lib/http.ts`). Sources receive web `Response` objects so
  their status handling and messages stay exact.
- Each adapter in `src/sources/adapters/` is an `Effect` that reads its client
  service. `SourceRegistryLive` builds the capability registries in source
  order.
- Use `batched` (`src/lib/batched.ts`) for polite request batching. Keep each
  call site's batch size and gap (ADR-0003).
- Decode upstream JSON once with `decodeJson` (`src/lib/decode.ts`). Use
  `open()` from `src/lib/validation/shared.ts` for objects that keep unknown
  keys.
- Pure helpers that can fail return `Result` from `effect`.
- Tests provide fixtures through `test/support/http.ts` or stub a service with
  `Layer.succeed`. The golden tests in `test/golden/` protect data, errors, and
  CLI output.
