# TypeScript Development Style Guide

This guide documents the conventions used by fitzRoy, a strict TypeScript
library and CLI for accessing and normalising AFL data.

## Architecture

Keep the library organised as a pure core with an effectful shell:

- `src/transforms/` contains deterministic transformations with no network or
  filesystem I/O.
- `src/sources/` owns upstream HTTP requests, scraping, validation, and
  source-specific errors.
- `src/api/` provides thin public adapters that select sources and compose their
  results.
- `src/types.ts` is the shared domain model, while `src/index.ts` defines the
  public surface.
- `src/cli.ts` and `src/cli/` are a presentation layer over the public library
  API.

Do not put source-specific response shapes into public APIs or business logic
into CLI commands.

## TypeScript and Naming

The compiler runs in strict mode with `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals`, and `noUnusedParameters`. Do not
use `any`, non-null assertions, or TypeScript `enum`. Narrow `unknown`, handle
missing indexed values, and use string unions instead.

- Use `camelCase` for variables and functions, `PascalCase` for types and
  classes, and `SCREAMING_SNAKE_CASE` only for true constants.
- Name files with `kebab-case.ts` and tests with `*.test.ts`.
- Prefix booleans with `is`, `has`, `should`, or `can`.
- Treat abbreviations as words (`AflApiClient`), except established two-letter
  forms such as `ID` and `IO`.
- Prefer `interface` for object shapes and `type` for unions, intersections, and
  mapped types.
- Use `readonly` where callers should not mutate domain data.
- Do not add default exports outside the configuration files explicitly allowed
  by Biome.

## Validation and Errors

Validate untrusted upstream payloads with Zod at their source boundary, then
pass typed domain values to transforms and public adapters. Infer source types
from their schemas when practical so runtime validation and static types cannot
drift.

Use the `Result` pattern from `src/lib/result.ts` for expected failures:

```typescript
type Result<T, E> = { success: true; data: T } | { success: false; error: E };
```

Reserve thrown exceptions for programmer errors and unexpected failures.
Preserve useful source context when converting validation, network, and parsing
errors into repository error types.

## Portability

Core library code uses Web-standard APIs such as `fetch`, `Request`, `Response`,
`URL`, and `crypto`. Do not use Node or Bun APIs in portable core modules. The
CLI, tests, build tooling, and scripts may use Node APIs. Bun-specific runtime
APIs must not leak into the published library.

Run `npm run typecheck:portable` whenever core imports change. The CLI is the
intentional Node runtime exception and may use `process` and other Node
facilities for terminal behaviour.

## Transforms and Concurrency

Prefer pure transformations and immutable array operations such as `filter`,
`map`, and `sort`. Keep network access and other effects in source modules. Use
bounded concurrency helpers for upstream requests where rate limits matter. Use
`Promise.allSettled` only when partial failure is an explicit part of the API
contract.

## Dependencies and Commands

Bun is the contributor package manager and `bun.lock` is the only committed lock
file. npm remains a supported package consumer: documentation may correctly use
`npm install fitzroy`.

Install contributor dependencies with `bun install`. The repository scripts are:

```bash
npm run typecheck          # strict TypeScript check
npm run typecheck:portable # verify the core without Node types
npm run check              # Biome lint and formatting check
npm run test               # Vitest in watch mode locally
npx vitest run             # run the suite once
npm run test:coverage      # run tests with coverage thresholds
bun run build              # build the ESM library, declarations, and CLI
npm run format             # apply Biome formatting
```

Update Vitest and `@vitest/coverage-v8` together at the exact same version. Keep
Node type definitions on the minimum supported Node major unless the runtime
floor is deliberately raised everywhere.

## Testing

Unit tests must be deterministic and must not call live APIs. Store
representative upstream responses under `test/fixtures/`, then test schemas
against valid and invalid payloads and test pure transforms thoroughly. Name
test cases as sentences describing observable behaviour.

When changing a public adapter, cover source routing, filtering, successful
results, and expected errors. When changing packaging or exports, verify the
packed artefact as an npm consumer rather than importing source files directly.

## Documentation

Document public functions and exported types with TSDoc when their contract is
not obvious. Use `@param`, `@returns`, `@throws`, and focused examples where
they help consumers. Update the README, changelog, and ecosystem documentation
only when their public contracts change.
