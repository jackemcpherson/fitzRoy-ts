# ADR-0001: No Silent Cross-Source Fallback

This decision keeps source selection explicit when a request falls outside a
provider's coverage.

| Property | Value      |
| -------- | ---------- |
| Status   | Accepted   |
| Date     | 6 May 2026 |

## Context

fitzRoy queries AFL API, AFL Tables, FootyWire, Squiggle, Fryzigg, and AFL
Coaches. Each source covers different competitions, seasons, and fields.

The library could route an unsupported request to another source. For example,
AFL Tables could answer an AFLM 2005 request that AFL API cannot serve.

## Decision

The public API never changes sources silently. It returns a structured coverage
error and suggests an explicit alternative when one exists.

```text
Error: AFL API only covers AFLM from 2012.
Try `--source afl-tables` for earlier seasons.
```

## Rationale

Source field shapes differ. Changing providers can turn a time-series comparison
into a comparison of different definitions or missing values.

Downstream analysis also needs provenance. Explicit selection lets consumers
understand the source of every result without inferring it from field shape.

A coverage error teaches the caller which provider can answer the request. A
silent fallback hides this boundary.

## Consequences

- Unsupported requests return an error instead of data from another source.
- Errors name an alternative source when the registry has one.
- Adapter coverage declarations must remain accurate.
- Some requests have no valid provider and therefore no result.

## Review Trigger

Reconsider this decision only if providers converge on equivalent field
definitions and provenance no longer affects downstream interpretation.

## References

- [R package parity and coverage notes](../r-parity.md)
