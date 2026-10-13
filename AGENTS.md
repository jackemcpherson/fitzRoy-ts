# AGENTS.md

This file is the agent-neutral companion to `CLAUDE.md`. Treat `CLAUDE.md` as
the canonical, detailed repository guide; the constraints and patterns below
must remain synchronized with it.

## Commands

Run the complete quality gate before committing:

```bash
npx vp check
npm run typecheck:portable
npx vp test
bun run build
npm run verify:package
```

Use `npx vp test run test/path/to/file.test.ts` for a focused test. Bun is the
package manager, and Vite+ (`vp`) runs formatting, linting, type checks, tests,
and packaging from `vite.config.ts`.

## Architecture and constraints

- Keep transforms pure in `src/transforms/`, source I/O and validation in
  `src/sources/`, public composition in `src/api/`, and presentation logic in
  `src/cli/`.
- `src/types.ts` defines the domain models as Effect schemas and derives their
  types. `src/index.ts` defines the public package surface.
- Use Web Standard APIs in library source. Node-specific process APIs belong
  only in the CLI, and Bun-specific runtime APIs do not belong in `src/`.
- Validate untrusted data with Effect Schema at source boundaries, then use
  typed domain values internally.
- Track expected failures in the Effect error channel as `Schema.TaggedError`
  classes, and capabilities in the requirements channel as services. Do not
  throw or use `try/catch` in application logic. Pure fallible helpers return
  `Result` from `effect`.
- Each data source is a `Context.Service` with a `*Live` layer over
  `SourceHttp`. `FitzroyLive` (`src/layers.ts`) provides every service.
- Keep TypeScript strict: no explicit `any`, enums, or default exports. Handle
  unchecked indexed access and exact optional properties explicitly.
- Use `Effect.all` with an explicit concurrency for all-or-nothing work, and
  `batched` with `Effect.result` per item where partial failure is part of the
  contract.
- Public exports require TSDoc and meaningful fixture-based tests. Tests must
  not call live upstream services, and must not mock modules: provide fixtures
  through `test/support/http.ts` or stub a service with `Layer.succeed`.

Follow the published TypeScript style guide and the project exceptions in
`docs/typescript-style-guide.md`.

## Ralph and release workflow

- `plans/README.md` tracks advisor plans; `plans/PROGRESS.txt` is append-only.
- Record user-facing changes beneath `CHANGELOG.md`'s `[Unreleased]` heading
  using Keep a Changelog categories.
- Before release, run the release-readiness review, prepare a dated semantic
  version, rebuild, verify the working tree is clean, and ensure the version's
  git tag does not already exist.
- When public functions, types, data-source coverage, endpoints, schema, CLI,
  or cron behaviour changes, review the public ecosystem document at
  `homepage/public/docs/afl-data-ecosystem.md` in the sibling homepage repo.
