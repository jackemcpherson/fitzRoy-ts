# ADR-0002: Pre-2021 VFL/VFLW out of scope

**Status:** Accepted
**Date:** 2026-05-06

## Context

When AFLW (2017+) and VFL/VFLW (modern AFL Reserves, 2021+) were added to
scope for the 2.0 release, the question arose: how far back should each
competition be supported?

The hard requirements settled in design review:
- AFLM from **1990** (start of the AFL era)
- AFLW from **2017** (full history; AFLW didn't exist before then)
- VFL/VFLW "**ideally**" with comparable historical depth

The "ideally" was investigated by probing available sources.

## Decision

**Pre-2021 VFL and VFLW data is out of scope for the 2.0 release.**

VFL and VFLW are supported from 2021+ via the AFL API (which began tracking
the modern AFL Reserves competition that year). Earlier seasons return a
clear "no source covers this request" error.

## What we found

Three sources were checked for pre-2021 VFL coverage:

1. **AFL Tables** (`afltables.com`): probed at multiple URL patterns
   (`/vfl/seas/`, `/vfl/`, `/afl/vfl/`, etc.) — every URL returns 404.
   AFL Tables is AFLM-only; it has never hosted VFL data.

2. **vflstats.com.au**: this is the source the R `fitzRoy` package's
   `fetch_team_stats(source = "vflstats")` points at. The domain returned DNS
   errors on every variant (`vflstats.com`, `vflstats.com.au`,
   `www.vflstats.com`, `www.vflstats.com.au`). The site appears to be dead.

3. **AFL API**: confirmed only goes back to 2021 for VFL (compId=7) and
   VFLW (compId=11).

The probe is at `scripts/probe-afl-tables.ts` and can be re-run if any
source's status changes.

## Why deferred, not done

Adding pre-2021 VFL would require finding and scraping a new source. Likely
candidates (the VFL website itself, archived state-league sites, third-party
historical databases) are each non-trivial scraping engagements with
unknown data quality. None of this work is reusable across other
competitions; it's purely VFL-specific.

The 2.0 release already delivers significant scope: AFLW and VFL/VFLW (2021+)
become first-class, the public API consolidates into six commands, and the
source-adapter architecture lands. Adding another scraping vertical for
historical VFL would meaningfully delay 2.0 without being requested by
existing users.

## Consequences

- VFL and VFLW queries with `season < 2021` return an out-of-range error.
- Users who genuinely need pre-2021 VFL data will have to source it
  themselves (or open an issue requesting we investigate further).
- If a usable source for historical VFL is found later, it can be added as
  an additional adapter without breaking changes — the source-adapter
  pattern accommodates new adapters cleanly.

## Will be re-suggested

Yes. The asymmetry — AFLM history back to 1897, VFL only back to 2021 — is
visible enough that future contributors will propose closing the gap. Don't
reopen unless one of the following changes:

- A reliable source for pre-2021 VFL data is found, OR
- A user files a concrete request explaining their need, OR
- An ADR-0001 reversal makes silent multi-source routing acceptable (it
  isn't, see ADR-0001).
