# ADR-0001: No silent cross-source fallback

**Status:** Accepted
**Date:** 2026-05-06

## Context

fitzRoy-ts queries multiple AFL data sources (AFL API, AFL Tables, FootyWire,
Squiggle, Fryzigg, AFL Coaches). Each source covers a different subset of
competitions and seasons (see CONTEXT.md, "Source coverage").

A natural design instinct, when designing the unified `--source` UX, is to
silently fall back to a different source when the chosen source can't serve
the request. For example: AFL API only has AFLM data from 2012; if a user
asks for AFLM 2005, the system *could* automatically route to AFL Tables
(which has data back to 1897) and return data without complaint.

This was considered and rejected during architecture review (May 2026).

## Decision

**The public API never silently routes to a different source.** When a
request falls outside the chosen source's coverage, the API returns a
structured error suggesting an alternative `--source` value.

```
Error: AFL API only covers AFLM from 2012.
Try `--source afl-tables` for earlier seasons.
```

## Why

Three reasons, in order of importance:

1. **Field shapes differ subtly between sources.** AFL API returns rich stats
   (kicks, marks, advanced metrics like ratingPoints, extendedStats);
   AFL Tables returns the classic stat lines but lacks the advanced fields;
   FootyWire returns yet another shape. A user comparing 2010 (afl-tables
   fallback) against 2015 (afl-api) would silently get incomparable data.
   The nullable fields would mask which source was used.

2. **Provenance matters for downstream analysis.** Users of fitzRoy-ts often
   build pipelines that join, average, or model this data. They need to know
   *which* source produced *which* row. Silent routing destroys that
   information unless we add a per-row source field — at which point we've
   reinvented the explicit `--source` choice without the user-facing clarity.

3. **Failure becomes feedback.** An explicit "try `--source afl-tables`" error
   teaches users which source covers what. Silent fallback hides the
   architecture.

## Consequences

- Users querying outside default coverage see an error, not data.
- The error message must be helpful — it must name the alternative source.
- The capability descriptors on each adapter (Phase B) need to be accurate
  enough that the suggestion in the error is correct.
- We accept that some requests have no answer (e.g., AFLW 2005 doesn't exist
  on any source — and AFLW didn't exist as a competition), and the error in
  those cases just states "no source covers this request."

## Will be re-suggested

Yes. Future architecture reviews will look at the user experience and propose
"why don't we auto-route?" This is a reasonable instinct that needs an
explicit answer. This ADR is that answer. Don't reopen unless one of the
three reasons above no longer holds.
