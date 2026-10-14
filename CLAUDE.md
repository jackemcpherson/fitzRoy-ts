# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

fitzRoy-ts is a TypeScript port of the [fitzRoy R package](https://github.com/jimmyday12/fitzRoy), providing programmatic access to AFL (Australian Football League) data from multiple sources (AFL API, FootyWire, AFL Tables) as a pure TypeScript library using only Web Standard APIs.

## Commands

```bash
# Install (Vite+ picks Node from .node-version and pnpm from packageManager)
vp install

# Quality checks (run all before committing)
vp check                     # Oxfmt + Oxlint (anti-slop) + tsgo type check
vp run typecheck:portable    # library core compiles without Node types
vp test                      # Vitest

# Apply formatting and lint autofixes
vp check --fix

# Single test file
vp test run test/path/to/file.test.ts

# Build (library + CLI)
vp run build             # vp pack → dist/index.js, dist/schemas.js, .d.ts, dist/cli.js

# Compiled standalone binary (Node single executable; needs Node 25.7+)
vp env use 26 && vp run build:exe   # → build/cli

# Live scraper canary (runs the TypeScript sources directly on Node)
vp run canary
```

**Note:** `vp check` covers formatting, linting, and type checking. All configuration lives in `vite.config.ts`.

## Architecture

The codebase follows a "pure core, effectful shell" pattern:

- **`src/index.ts`** — Package entry point (re-exports public API)
- **`src/types.ts`** — Domain models as Effect schemas, with derived types (single source of truth for the data model)
- **`src/layers.ts`** — `FitzroyLive` and `SourcesLive` layer composition
- **`src/sources/`** — Data source services (effectful shell), each a `Context.Service` plus `*Live` layer over `SourceHttp`; `src/sources/adapters/` holds per-capability adapters and `SourceRegistryLive`
- **`src/transforms/`** — Pure response normalisation and data flattening
- **`src/api/`** — Public API functions (fetchMatchResults, fetchPlayerStats, etc.)
- **`src/lib/`** — Shared utilities: `http.ts` (`SourceHttp`, timeout and retry policy), `batched.ts` (polite batching), `decode.ts` (boundary decoding), `errors.ts` (tagged errors), `validation/` (upstream wire schemas), `team-mapping.ts` (team name normalisation), `date-utils.ts` (AEST/AEDT-aware dates)
- **`src/cli.ts`** — CLI entry point (shebang, root command, error boundary). NOT importable from `src/index.ts`.
- **`src/cli/commands/`** — Citty subcommands (team, player, match, stats, ladder, awards)
- **`src/cli/formatters/`** — Output formatters (table, JSON, CSV) and format dispatcher
- **`src/cli/ui.ts`** — Spinner and summary helpers wrapping @clack/prompts
- **`test/fixtures/`** — Fixture data for snapshot-based tests (no live API calls)

## Key Constraints

- **No Node.js built-ins in `src/`** — only Web Standard APIs (`fetch`, `Request`, `Response`, `URL`, `crypto`). Exception: `src/cli.ts` and `src/cli/` may use `process` for TTY detection and exit codes. Test files (`test/`) may use Node.js built-ins (`node:fs`, `node:path`) for loading fixtures.
- **No `any`** — Oxlint enforces `typescript/no-explicit-any: "error"`. Decode unknown input with Effect Schema at the boundary.
- **No `enum`** — use union types instead (e.g., `type RoundType = "HomeAndAway" | "Finals"`).
- **No default exports** — Oxlint enforces `import/no-default-export: "error"`, with overrides only for `*.config.ts`. Vendored upstream code in `tools/oxlint/anti-slop/` keeps its own style and is excluded from lint; local patches there are marked `Local patch`.
- **Strict TypeScript** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters` are all enabled.
- **Package manager** — pnpm, run through Vite+ (`vp install`, `vp add`, `vp run`). `pnpm-lock.yaml` is the lockfile; overrides live in `pnpm-workspace.yaml`.
- **`effect` is a peer dependency** — consumers compose fitzroy's Effects with their own `effect`, so it must be one shared copy. It is also a pinned devDependency for local work; tsdown keeps it external.
- **Erasable syntax only** — `erasableSyntaxOnly` is on so Node can run the sources by stripping types (CLI golden tests, canary). No `enum`, `namespace`, or constructor parameter properties. `scripts/ts-resolve.mjs` resolves the extensionless relative imports.

## Style Guide

The published TypeScript style guide applies, with the project exceptions in `docs/typescript-style-guide.md` (Effect 4 names, library and CLI exceptions). Key conventions:

### Naming

- Variables/functions: `camelCase`. Types/interfaces: `PascalCase`. True constants: `SCREAMING_SNAKE`.
- File names: `kebab-case.ts`. Test files: `*.test.ts`.
- Booleans: prefix with `is`, `has`, `should`, `can`.
- Abbreviations as words: `AflApi`, not `AFLApi`. Exception: two-letter acronyms stay uppercase (`ID`, `IO`).

### Types

- Prefer `interface` for object shapes, `type` for unions/intersections/mapped types.
- Derive types from Effect schemas (`typeof Schema.Type`) — the schema is the single source of truth.
- Use `readonly` for data that shouldn't change.
- Use discriminated unions with a `type` field for mixed result types.

### Patterns

- **Validate at boundaries, trust internally** — Effect Schema at API/scrape boundaries (`decodeJson`), then trust the types downstream.
- **Effect error channel** — expected failures are `Schema.TaggedError` classes in the `E` channel; never throw. Pure fallible helpers return `Result` from `effect`.
- **Services and layers** — sources are `Context.Service`s with `*Live` layers; adapters are Effects that read their service.
- **Functional transforms** — chain `.filter().map().sort()` over mutation.
- **`Effect.all`** with explicit concurrency for concurrent fetches; `batched` plus `Effect.result` when partial failure is acceptable.
- **Types first** — define domain types in `types.ts` before implementation.
- **Composition over inheritance** — classes only for stateful things (e.g., API clients with cached tokens).

### Documentation (TSDoc)

- Document all public functions, exported interfaces/types, module-level constants.
- Use `@param`, `@returns`, `@example` tags.
- Skip docs for self-explanatory one-liners.

### Testing

- Snapshot API responses into `test/fixtures/`. Never hit real APIs in tests.
- Test transforms thoroughly — they're pure functions.
- Test Effect schemas against both valid and invalid payloads.
- Use `@effect/vitest` `it.effect` for effects. Provide fixtures through `test/support/http.ts`, or stub a service with `Layer.succeed`. Never mock modules.
- Name tests as sentences: `it("handles missing periodScore gracefully")`.

## Tech Stack

| Tool | Purpose |
|------|---------|
| Effect 4 | Typed errors, services and layers, schemas, concurrency, HTTP (`effect/http`) |
| parse5 + cheerio/slim | HTML parsing for scraper sources (parse5 tree + cheerio selectors via `src/lib/parse-html.ts`; cheerio's full entry imports `node:stream` and breaks Workers) |
| Vite+ (`vp`) | Oxfmt formatting, Oxlint + vendored anti-slop linting, tsgo type checks, Vitest, tsdown packing |
| Vitest + `@effect/vitest` | Test runner (via `vp test`, globals enabled) |
| Citty | CLI command framework (defineCommand, runMain) |
| @clack/prompts | Terminal spinners and interactive feedback |
| picocolors | Terminal colour output |

## CLI Architecture

The CLI is a thin presentation layer over the library — no business logic. Each command:
1. Defines args via Citty `defineCommand` (args are strings, convert with `Number()`)
2. Runs the corresponding library Effect (e.g. `fetchMatches`) on the shared `ManagedRuntime` in `src/cli/runtime.ts`
3. Passes the result through the format dispatcher (`src/cli/formatters/index.ts`)
4. Writes to stdout

**Format resolution priority:** `--json` > `--csv` > `--format` > TTY detection (non-TTY defaults to JSON).

**Error boundary:** a failed command Effect is formatted by `formatError` in `src/cli/error-boundary.ts` (Effect `Match` over the tagged errors) and printed as a coloured message without a stack trace. Exit code 1 on error, 0 on success.

**Build:** `vp pack` (tsdown) builds two configs from `vite.config.ts`: the neutral-platform library (`src/index.ts`, `src/schemas.ts`, with `.d.ts`) and the Node CLI (`src/cli.ts`, with `PACKAGE_VERSION` defined). Runtime `dependencies` stay external, and CLI-only devDependencies are bundled. CI re-runs the CLI golden tests against `dist/cli.js` to catch bundling regressions.

## Ralph Workflow

This project uses Ralph — an autonomous iteration loop for completing user stories.

**Key files:**
- `plans/README.md` — advisor plan index (execution order + status)
- `plans/PROGRESS.txt` — Append-only iteration log

**Iteration process:**
1. Pick highest-priority story where `passes: false`
2. Implement the story
3. Run quality checks: `npx vp check && npm run typecheck:portable && npx vp test`
4. Fix failures and re-run (up to 3 attempts)
5. Commit: `feat: [Story ID] - [Story Title]`
6. Update the plan's status row in `plans/README.md` and append to PROGRESS.txt
7. Update this file with discovered patterns

## CHANGELOG.md

Maintain a CHANGELOG.md under `[Unreleased]` using categories: Added, Changed, Deprecated, Removed, Fixed, Security. Only update for user-facing changes — not refactors, tests, docs, or formatting.

## Ecosystem doc

The public ecosystem doc (homepage repo: `public/docs/afl-data-ecosystem.md`,
served at jackemcpherson.com/docs/afl-data-ecosystem.md) describes this
project's public surface. If a change alters that surface — exported
functions/types, data sources or coverage, endpoints, DB schema, CLI
commands, cron behavior — update the doc in the same sitting.
