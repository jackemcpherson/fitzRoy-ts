# ADR-0003: Adapter PlayerStats batching loops are intentionally not unified

**Status:** Accepted
**Date:** 2026-05-06

## Context

The three `PlayerStatsSource` adapters — `AflApiPlayerStatsSource`,
`FootyWirePlayerStatsSource`, `AflTablesPlayerStatsSource` — each implement a
similar-shaped loop:

1. Resolve match IDs for a season (or filtered to a round).
2. Batch-fetch per-match stats.
3. Concatenate into a single `PlayerStats[]`.

Surface similarity makes this look like obvious duplication. A natural
refactor instinct is to extract a shared higher-order helper that takes
"id resolver" + "per-id transform" + "batching options" as primitives, with
each adapter providing only its source-specific bits.

This was considered during architecture review (May 2026) and rejected.

## Decision

**The three loops stay separate.** Each adapter owns its full pipeline. The
only shared primitive is `batchedMap` (in `src/lib/concurrency.ts`), which
exposes a `delayMs` option for politeness delays in scraper sources.

## Why

The loops differ on five orthogonal axes — and three of those differences
are deliberate product choices, not implementation accidents.

1. **`matchId` fast-path.** AFL API can fetch stats for a single match
   directly via `/cfs/afl/playerStats/{matchId}` and is the only adapter
   that exposes this fast-path. The other two have to walk the full
   round/season list. A unified helper would either lose the fast-path or
   require a "skip the resolver step" branch that defeats the abstraction.

2. **Roster / `teamIdMap` pre-fetch.** The AFL API path needs an extra
   roster fetch to map the API's opaque team IDs to canonical team names
   before the per-match transform runs. The scrapers already get team
   names in their stats payload. The pre-fetch is single-source.

3. **Politeness delay between batches.** FootyWire and AFL Tables sleep
   500ms between batches to be respectful to the scraped sites. AFL API is
   a real API and doesn't need it. (Captured by the `delayMs` option on
   `batchedMap`, which IS shared.)

4. **Error semantics — fail-fast vs best-effort.** The AFL API adapter
   returns the first error it sees (`return statsResult ?? err(...)`) —
   any failure is a bug, surface it. The scrapers silently skip failed
   matches and continue (`if (result.success) allStats.push(...)`) —
   scrapers fail often (404s on missing match pages, transient HTML
   changes), and best-effort is the right product choice. A unified
   helper would have to expose this as a parameter, at which point the
   caller still has to think about it.

5. **Per-match transform context.** AFL API's `transformPlayerStats`
   takes a rich context object (`matchId`, `season`, `roundNumber`,
   `competition`, `teamIdMap`, `date`, `homeTeam`, `awayTeam`). The
   scrapers' stats are already shaped at the source layer and need
   nothing extra. Threading a "per-source context" type through a generic
   helper is more code than the duplication it removes.

## What we did instead

Extracted the one piece that genuinely is shared: the politeness delay.
`batchedMap` now accepts an optional `delayMs` option, and
`FootyWirePlayerStatsSource` uses it instead of its hand-rolled batching
loop. ~5-line net change.

## Consequences

- The three adapter `fetchPlayerStats` methods stay roughly 30–80 lines
  each. They look similar and they are — but the differences are
  load-bearing.
- New `PlayerStatsSource` adapters (e.g. a future Squiggle or Fryzigg
  player-stats path) should write their own loop, copying the closest
  existing adapter as a starting point. Don't try to subclass or
  parameterise off an existing one.
- If a fourth adapter lands and its loop is genuinely identical to one
  of the existing three (same fast-path, same error semantics, same
  transform context), reopen this ADR — at four, the case for extraction
  is stronger.

## Will be re-suggested

Yes. The visual similarity of the three loops is striking enough that
future architecture reviews will propose extraction. This ADR is the
answer. Don't reopen unless one of the five axes above collapses (e.g.
all sources adopt the same error semantics, or roster pre-fetch
disappears) — or a fourth adapter lands with an identical-shape loop.
