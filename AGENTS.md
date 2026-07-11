# AGENTS.md

This file is the agent-neutral companion to `CLAUDE.md`. Treat `CLAUDE.md` as
the canonical, detailed repository guide; the constraints and patterns below
must remain synchronized with it.

## Commands

Run the complete quality gate before committing:

```bash
npm run typecheck
npm run typecheck:portable
npm run check
npm run test
bun run build
node scripts/verify-package-install.mjs
```

Use `npx vitest run test/path/to/file.test.ts` for a focused test. Bun is the
package manager and build runner, while npm scripts remain supported.

## Architecture and constraints

- Keep transforms pure in `src/transforms/`, source I/O and validation in
  `src/sources/`, public composition in `src/api/`, and presentation logic in
  `src/cli/`.
- `src/types.ts` is the domain-model source of truth and `src/index.ts` defines
  the public package surface.
- Use Web Standard APIs in library source. Node-specific process APIs belong
  only in the CLI, and Bun-specific runtime APIs do not belong in `src/`.
- Validate untrusted data with Zod at source boundaries, then use typed domain
  values internally.
- Return the repository's `Result` union for expected failures. Reserve thrown
  errors for unexpected failures handled by the CLI boundary.
- Keep TypeScript strict: no explicit `any`, enums, or default exports. Handle
  unchecked indexed access and exact optional properties explicitly.
- Use `Promise.all` for all-or-nothing concurrency and `Promise.allSettled`
  where partial failure is part of the contract.
- Public exports require TSDoc and meaningful fixture-based tests. Tests must
  not call live upstream services.

Follow `docs/TYPESCRIPT_STYLE_GUIDE.md` for naming, types, validation, error,
documentation, and test conventions.

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
