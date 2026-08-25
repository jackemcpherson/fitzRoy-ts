# ADR-0003: Keep Player-Stat Adapter Loops Separate

This decision preserves source-specific player-stat pipelines while sharing only
the bounded-concurrency primitive.

| Property | Value      |
| -------- | ---------- |
| Status   | Accepted   |
| Date     | 6 May 2026 |

## Context

The AFL API, FootyWire, and AFL Tables adapters follow the same broad sequence:

1. Resolve match IDs for a season or round.
2. Fetch player statistics in batches.
3. Combine the rows into `PlayerStats[]`.

Their similar shape suggests a shared higher-order pipeline.

## Decision

Each adapter retains its complete pipeline. All three share `batchedMap` from
`src/lib/concurrency.ts`, including its optional `delayMs` control.

## Rationale

The implementations differ across five important behaviours.

### Single-Match Fast Path

AFL API fetches one match directly through its player-stat endpoint. Scraper
adapters must first traverse a round or season page.

### Roster Preparation

AFL API fetches a roster to translate opaque team IDs. Scraped pages already
contain team names.

### Request Delays

FootyWire and AFL Tables wait 500 milliseconds between batches. AFL API does not
need the scraper politeness delay.

### Failure Semantics

AFL API fails on the first provider error. Scrapers return partial season
results and identify failed matches because individual pages often disappear or
change.

### Transform Context

The AFL API transform needs match, competition, team, date, and roster context.
Scraper adapters shape their rows at the source boundary.

A generic pipeline would expose each difference as another option. The resulting
interface would be more complex than the duplicated control flow.

## Consequences

- The three adapter methods retain similar 30-to-80-line loops.
- New adapters should begin from the closest source implementation.
- Contributors should not subclass or parameterise an existing adapter loop.
- `batchedMap` remains the shared concurrency and delay mechanism.

## Review Trigger

Reconsider extraction when another adapter has identical fast-path, preparation,
failure, delay, and transform requirements.
