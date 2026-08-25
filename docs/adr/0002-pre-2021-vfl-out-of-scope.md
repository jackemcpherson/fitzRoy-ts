# ADR-0002: Pre-2021 VFL and VFLW Are Out of Scope

This decision defines the historical coverage boundary for VFL and VFLW data.

| Property | Value      |
| -------- | ---------- |
| Status   | Accepted   |
| Date     | 6 May 2026 |

## Context

Version 2.0 added AFLW, VFL, and VFLW. The required coverage begins in 1990 for
AFLM and 2017 for AFLW. The review also investigated deeper VFL coverage.

The investigation found no usable provider for pre-2021 VFL or VFLW data:

- AFL Tables did not expose VFL seasons through the tested URL patterns.
- The historical `vflstats` domain used by R fitzRoy did not resolve.
- AFL API exposed the modern competitions from 2021.

The probe remains in `scripts/probe-afl-tables.ts` for later verification.

## Decision

The library supports VFL and VFLW from 2021 through AFL API. Earlier requests
return an out-of-range error stating that no source covers the request.

## Rationale

Earlier coverage needs a new provider and a dedicated scraper. That work carries
unknown data-quality and maintenance costs.

Version 2.0 already added three competitions, a consolidated API, and the source
adapter architecture. Historical VFL work would delay those improvements without
an established consumer requirement.

## Consequences

- VFL and VFLW queries before 2021 return an out-of-range error.
- Consumers requiring older data must provide another source or request support.
- A future adapter can add coverage without breaking the existing API.

## Review Triggers

Reconsider this decision when any of these conditions applies:

- A reliable pre-2021 provider becomes available.
- A consumer documents a concrete historical-data requirement.
- The project reverses [ADR-0001](0001-no-cross-source-fallback.md).

## References

- [AFL Tables](https://afltables.com/)
- [R fitzRoy package](https://github.com/jimmyday12/fitzRoy)
