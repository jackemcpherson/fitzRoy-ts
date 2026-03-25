# Agent Instructions

## Overview

fitzRoy-ts - [Add project description here]

This file contains instructions for AI agents working on this codebase.
It is kept in sync with CLAUDE.md.

## Ralph Workflow

This project uses the Ralph autonomous iteration pattern.

**Key files:**
- `plans/SPEC.md` - Feature specification
- `plans/TASKS.json` - Task list with completion status
- `plans/PROGRESS.txt` - Append-only iteration log
- `CLAUDE.md` - Claude-specific instructions and quality checks

**Iteration process:**
1. Read `plans/TASKS.json` to find the highest-priority incomplete story
2. Implement the story following acceptance criteria
3. Run quality checks defined in `CLAUDE.md`
4. Fix any failures and re-run (up to 3 attempts)
5. Commit with message: `feat: [Story ID] - [Story Title]`
6. Update `plans/TASKS.json` to mark `passes: true`
7. Append summary to `plans/PROGRESS.txt`
8. Update CLAUDE.md and this file with any discovered patterns

## Codebase Patterns

(Keep in sync with CLAUDE.md)

- Biome v2 uses `files.includes` with `!!**/folder` negation patterns (not `files.ignore`)
- tsconfig.json `types` array is empty (no @cloudflare/workers-types)
- Biome enforces import ordering; exports from index.ts must be alphabetical by module path
- Project is a pure library (no Worker runtime); only Web Standard APIs allowed

## CHANGELOG.md

This project maintains a CHANGELOG.md for persistent memory across feature cycles.

**When to update:**
- New features or capabilities added
- Bug fixes that affect user-facing behavior
- Breaking changes or API modifications
- Performance improvements with measurable impact
- Security fixes
- Deprecations of existing functionality

**When NOT to update:**
- Internal refactoring with no behavior change
- Test additions or modifications
- Documentation-only changes
- Code style/formatting changes
- Dependency updates (unless they fix security issues or change behavior)
- Work-in-progress commits during a feature branch

**How to update:**
1. Add entries under the `[Unreleased]` section
2. Use the appropriate category: Added, Changed, Deprecated, Removed, Fixed, Security
3. Write entries from the user's perspective (what changed for them)
4. Be concise but specific (include context like file names or feature areas)

## Guidelines

- Always read `plans/PROGRESS.txt` first to understand patterns from previous iterations
- Check CLAUDE.md for quality checks and project-specific instructions
- Work on ONE story per iteration
- Commit after each successful story
- Keep all quality checks passing
