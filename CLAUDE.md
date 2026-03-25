# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

fitzRoy-ts is a TypeScript port of the [fitzRoy R package](https://github.com/jimmyday12/fitzRoy), providing programmatic access to AFL (Australian Football League) data from multiple sources (AFL API, FootyWire, AFL Tables) as a pure TypeScript library using only Web Standard APIs.

## Commands

```bash
# Quality checks (run all before committing)
npm run typecheck        # tsc --noEmit
npm run check            # biome check . (lint + format)
npm run test             # vitest

# Formatting
npm run format           # biome format --write .

# Single test file
npx vitest run test/path/to/file.test.ts
```

**Note:** There are no separate `lint` or `format:check` scripts. Use `npm run check` for both linting and format verification.

## Architecture

The codebase follows a "pure core, effectful shell" pattern:

- **`src/index.ts`** — Package entry point (re-exports public API)
- **`src/types.ts`** — Shared domain types (single source of truth for the data model)
- **`src/sources/`** — Data source clients (effectful shell): AFL API, FootyWire scraper, AFL Tables scraper
- **`src/transforms/`** — Pure response normalisation and data flattening
- **`src/api/`** — Public API functions (fetchMatchResults, fetchPlayerStats, etc.)
- **`src/lib/`** — Shared utilities: `result.ts` (Result type), `errors.ts` (custom errors), `validation.ts` (Zod schemas), `team-mapping.ts` (team name normalisation), `date-utils.ts` (AEST/AEDT-aware dates)
- **`test/fixtures/`** — Fixture data for snapshot-based tests (no live API calls)

## Key Constraints

- **No Node.js built-ins** — only Web Standard APIs (`fetch`, `Request`, `Response`, `URL`, `crypto`). No Bun-specific APIs either (`Bun.file()`, `Bun.serve()`).
- **No `any`** — Biome enforces `noExplicitAny: "error"`. Use `unknown` and narrow with Zod.
- **No `enum`** — use union types instead (e.g., `type RoundType = "HomeAndAway" | "Finals"`).
- **No default exports** — Biome enforces `noDefaultExport: "error"`, with overrides only for `*.config.ts`.
- **Strict TypeScript** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters` are all enabled.
- **Package manager** — bun (see `bun.lock`), but npm scripts work via `npm run`.

## Style Guide

Full style guide at `docs/TYPESCRIPT_STYLE_GUIDE.md`. Key conventions:

### Naming

- Variables/functions: `camelCase`. Types/interfaces: `PascalCase`. True constants: `SCREAMING_SNAKE`.
- File names: `kebab-case.ts`. Test files: `*.test.ts`.
- Booleans: prefix with `is`, `has`, `should`, `can`.
- Abbreviations as words: `AflApi`, not `AFLApi`. Exception: two-letter acronyms stay uppercase (`ID`, `IO`).

### Types

- Prefer `interface` for object shapes, `type` for unions/intersections/mapped types.
- Infer types from Zod schemas (`z.infer<typeof Schema>`) — schema is the single source of truth.
- Use `readonly` for data that shouldn't change.
- Use discriminated unions with a `type` field for mixed result types.

### Patterns

- **Validate at boundaries, trust internally** — Zod at API/scrape boundaries, then trust the types downstream.
- **Result pattern** — return `{ success: true; data: T } | { success: false; error: E }` for expected failures instead of throwing.
- **Functional transforms** — chain `.filter().map().sort()` over mutation.
- **`Promise.all`** for concurrent fetches; `Promise.allSettled` when partial failure is acceptable.
- **Types first** — define domain types in `types.ts` before implementation.
- **Composition over inheritance** — classes only for stateful things (e.g., API clients with cached tokens).

### Documentation (TSDoc)

- Document all public functions, exported interfaces/types, module-level constants.
- Use `@param`, `@returns`, `@throws`, `@example` tags.
- Skip docs for self-explanatory one-liners.

### Testing

- Snapshot API responses into `test/fixtures/`. Never hit real APIs in tests.
- Test transforms thoroughly — they're pure functions.
- Test Zod schemas against both valid and invalid payloads.
- Name tests as sentences: `it("handles missing periodScore gracefully")`.

## Tech Stack

| Tool | Purpose |
|------|---------|
| Zod | Runtime validation of API/scraped data |
| Cheerio | HTML parsing for scraper sources |
| Biome | Lint + format (replaces ESLint + Prettier) |
| Vitest | Test runner (globals enabled) |

## Ralph Workflow

This project uses Ralph — an autonomous iteration loop for completing user stories.

**Key files:**
- `plans/SPEC.md` — Full product requirements document
- `plans/TASKS.json` — Task list with completion status
- `plans/PROGRESS.txt` — Append-only iteration log

**Iteration process:**
1. Pick highest-priority story where `passes: false`
2. Implement the story
3. Run quality checks: `npm run typecheck && npm run check && npm run test`
4. Fix failures and re-run (up to 3 attempts)
5. Commit: `feat: [Story ID] - [Story Title]`
6. Update TASKS.json (`passes: true`) and append to PROGRESS.txt
7. Update this file and AGENTS.md with discovered patterns

## CHANGELOG.md

Maintain a CHANGELOG.md under `[Unreleased]` using categories: Added, Changed, Deprecated, Removed, Fixed, Security. Only update for user-facing changes — not refactors, tests, docs, or formatting.
