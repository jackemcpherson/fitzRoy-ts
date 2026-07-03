# Report 029: Canonicalisation gap closure — venues, round labels, round types

**Plan**: `plans/029-canonicalisation-gap-closure-spike.md`
**Baseline**: commit `9b1705c`
**Drift check**: `git diff --stat 9b1705c..HEAD -- src/lib/venue-mapping.ts src/types.ts src/index.ts` → no output (zero drift on all three files)
**Date**: 2026-07-02

---

## Step 1: Venue map diff

Consumer reference: `AFL-MCP /tmp/afl-mcp-canon/src/lib/constants.ts` — `VENUE_NAME_MAP` (36 key→value pairs).

**Summary: our map is already a strict superset. No missing aliases. No conflicting canonicals.**

| AFL-MCP alias | AFL-MCP canonical | Our canonical | Status |
|---|---|---|---|
| M.C.G. | MCG | MCG | already covered |
| S.C.G. | SCG | SCG | already covered |
| Docklands | Marvel Stadium | Marvel Stadium | already covered |
| Etihad Stadium | Marvel Stadium | Marvel Stadium | already covered |
| GMHBA Stadium | Kardinia Park | Kardinia Park | already covered |
| Manuka Oval | Manuka Oval | Manuka Oval | already covered |
| Corroboree Group Oval Manuka | Manuka Oval | Manuka Oval | already covered |
| Blundstone Arena | Blundstone Arena | Blundstone Arena | already covered |
| Bellerive Oval | Blundstone Arena | Blundstone Arena | already covered |
| Sydney Showground | Sydney Showground | Sydney Showground | already covered |
| ENGIE Stadium | Sydney Showground | Sydney Showground | already covered |
| GIANTS Stadium | Sydney Showground | Sydney Showground | already covered |
| Stadium Australia | Accor Stadium | Accor Stadium | already covered |
| ANZ Stadium | Accor Stadium | Accor Stadium | already covered |
| Cazaly's Stadium | Cazalys Stadium | Cazalys Stadium | already covered |
| TIO Stadium | TIO Stadium | TIO Stadium | already covered |
| Marrara Oval | TIO Stadium | TIO Stadium | already covered |
| TIO Traeger Park | Traeger Park | Traeger Park | already covered |
| Ikon Park | Princes Park | Princes Park | already covered |
| Mars Stadium | Mars Stadium | Mars Stadium | already covered |
| Eureka Stadium | Mars Stadium | Mars Stadium | already covered |
| People First Stadium | Carrara | Carrara | already covered |
| Heritage Bank Stadium | Carrara | Carrara | already covered |
| Carrara | Carrara | Carrara | already covered |
| Metricon Stadium | Carrara | Carrara | already covered |
| Perth Stadium | Perth Stadium | Perth Stadium | already covered |
| Optus Stadium | Perth Stadium | Perth Stadium | already covered |
| Gabba | Gabba | Gabba | already covered |
| The Gabba | Gabba | Gabba | already covered |
| York Park | UTAS Stadium | UTAS Stadium | already covered |
| UTAS Stadium | UTAS Stadium | UTAS Stadium | already covered |
| University of Tasmania Stadium | UTAS Stadium | UTAS Stadium | already covered |
| Jiangwan Stadium | Jiangwan Stadium | Jiangwan Stadium | already covered |
| Traeger Park | Traeger Park | Traeger Park | already covered |
| Riverway Stadium | Riverway Stadium | Riverway Stadium | already covered |
| Norwood Oval | Norwood Oval | Norwood Oval | already covered |

**Conflicting-canonical entries: NONE.**

Our `VENUE_ALIASES` has additional coverage absent from AFL-MCP:
aliases `Telstra Dome`, `Colonial Stadium` (Marvel Stadium); `Simonds Stadium`, `Skilled Stadium` (Kardinia Park); `Homebush` (Accor Stadium); `Showground Stadium` (Sydney Showground); `Aurora Stadium` (UTAS Stadium); `Melbourne Cricket Ground`, `Sydney Cricket Ground`, `Brisbane Cricket Ground` (full names); plus whole venues `Adelaide Oval`, `Subiaco Oval`, `Football Park`, `Blacktown International Sportspark`, `Barossa Park`, `Ninja Stadium / Summit Sports Park`.

**Action taken: none.** No additive aliases needed.

---

## Step 2: Team map diff

Consumer references examined:
1. `AFL-MCP src/lib/constants.ts` — `TEAM_NAME_MAP` (17 entries)
2. `AFL-MCP scripts/enrich-fryzigg.ts` — `FRYZIGG_TEAM_MAP` (30 entries)
3. `AFL-MCP scripts/backfill-lineups-early.ts` — inline `TEAM_NAME_MAP` (12 entries, same keys as #1)

**Key design divergence**: AFL-MCP normalises TO shorter names (`"Geelong"`, `"Adelaide"`, `"Sydney"`, `"West Coast"`, `"Gold Coast"`) matching the R fitzRoy convention, while fitzRoy-ts normalises TO the full AFL API canonical names (`"Geelong Cats"`, `"Adelaide Crows"`, `"Sydney Swans"`, `"West Coast Eagles"`, `"Gold Coast Suns"`). AFL-MCP does **not** call our exported `normaliseTeamName`; they maintain their own `normaliseTeam` wrapper over their own map. This is intentional per their codebase comment: "Fitzroy v2.1 returns canonical names…applying this map is a no-op for fitzroy-sourced data."

| AFL-MCP alias (input) | AFL-MCP → | Our → | Status |
|---|---|---|---|
| Greater Western Sydney | GWS Giants | GWS Giants | same destination ✓ |
| GWS | GWS Giants | GWS Giants | same destination ✓ |
| GWS GIANTS | GWS Giants | GWS Giants | same destination ✓ |
| Brisbane Bears | Brisbane Lions | Brisbane Lions | same destination ✓ |
| Brisbane | Brisbane Lions | Brisbane Lions | same destination ✓ |
| Footscray | Western Bulldogs | Western Bulldogs | same destination ✓ |
| Sydney Swans | "Sydney" | "Sydney Swans" | **different canonical** (convention difference) |
| Geelong Cats | "Geelong" | "Geelong Cats" | **different canonical** (convention difference) |
| Adelaide Crows | "Adelaide" | "Adelaide Crows" | **different canonical** (convention difference) |
| West Coast Eagles | "West Coast" | "West Coast Eagles" | **different canonical** (convention difference) |
| Gold Coast SUNS | "Gold Coast" | "Gold Coast Suns" | **different canonical** (convention difference) |
| Gold Coast Suns | "Gold Coast" | "Gold Coast Suns" | **different canonical** (convention difference) |
| Kuwarna | "Adelaide" | "Adelaide Crows" | different canonical (convention difference) |
| Walyalup | Fremantle | Fremantle | same destination ✓ |
| Narrm | Melbourne | Melbourne | same destination ✓ |
| Yartapuulti | Port Adelaide | Port Adelaide | same destination ✓ |
| Euro-Yroke | St Kilda | St Kilda | same destination ✓ |
| Waalitj Marawar | "West Coast" | "West Coast Eagles" | different canonical (convention difference) |

**Conflicting-canonical entries: 0 dangerous conflicts.** The 6 "different canonical" rows are a naming convention difference — AFL-MCP uses R-package-style short names; fitzRoy-ts uses full AFL API names. All input aliases ARE registered in our map and resolve to our canonical. AFL-MCP explicitly manages its own normaliser for this reason.

**SDNR indigenous names**: All 6 known aliases (`Kuwarna`, `Walyalup`, `Narrm`, `Yartapuulti`, `Euro-Yroke`, `Waalitj Marawar`) are already in our `TEAM_ALIASES`.

**Missing aliases from us**: none found across all three AFL-MCP sources.

**Action taken: none.**

---

## Step 3: Round-derivation helper spec

AFL-MCP implements three helpers in `src/sync/upserts.ts:76–109`:
- `deriveRound(m: Match): string` — long-form label
- `deriveRoundAbbreviation(m: Match): string` — short code (R fitzRoy `round.abbreviation` parity)
- `deriveRoundType(roundType: string): string` — maps `"HomeAndAway"` → `"Regular"`

### Inputs analysis

All three helpers operate solely on fields always present on `Match`:
- `roundNumber: number` — always non-null
- `roundName: string | null` — null only on sources that don't publish it (Squiggle)
- `roundType: RoundType` — always `"HomeAndAway" | "Finals"`

No live data required. The `AFLM_LAST_HA_ROUND` table in `afl-coaches.ts` is NOT needed by these helpers: `roundType` is already classified at the source layer. An optional `seasonLastHaRound` parameter would only be useful for re-deriving specific finals week names when `roundName === null`, but AFL-MCP's own approach returns `F${roundNumber}` in that case, which is acceptable.

**`AFLM_LAST_HA_ROUND` remains single-user**: it is only needed by `afl-coaches.ts`'s `isFinalsRound`. The round helpers receive `roundType` pre-classified, so there is no duplication and no new home needed for the table.

### Hard cases

| Input | roundLabel | roundAbbreviation | notes |
|---|---|---|---|
| roundNumber=0, roundName=null, HA | "Opening Round" | "OR" | 2024+ Opening Round has round 0 |
| roundNumber=0, roundName="Opening Round", HA | "Opening Round" | "OR" | AFL API path |
| roundNumber=N, roundName=null, HA | "Round N" | "Rd N" | non-AFL-API sources |
| roundName="Wildcard", Finals | "Wildcard" | "WC" | AFLW-specific round |
| roundName="Finals Week 1", Finals | "Finals Week 1" | "FW1" | handled by regex `Finals Week (\d+)` → `FW{N}` |
| roundName="Qualifying Finals", Finals | "Qualifying Finals" | "QF" | AFL-MCP omits QF/EF; we add them |
| roundName="Elimination Finals", Finals | "Elimination Finals" | "EF" | AFL-MCP omits; we add |
| roundName="Semi Finals", Finals | "Semi Finals" | "SF" | |
| roundName="Preliminary Finals", Finals | "Preliminary Finals" | "PF" | |
| roundName="Grand Final", Finals | "Grand Final" | "GF" | |
| roundNumber=N, roundName=null, Finals | "Finals N" | "F{N}" | imprecise fallback; specific week not derivable without seasonLastHaRound |
| unrecognised roundName, HA | raw roundName | "Rd {roundNumber}" | graceful fallback |
| unrecognised roundName, Finals | raw roundName | "F{roundNumber}" | graceful fallback |

### Specified signatures (implemented)

```ts
/** Long-form label — R fitzRoy round.name parity. */
export function roundLabel(
  roundNumber: number,
  roundName: string | null,
  roundType: RoundType,
): string

/** Short code — R fitzRoy round.abbreviation parity. */
export function roundAbbreviation(
  roundNumber: number,
  roundName: string | null,
  roundType: RoundType,
): string

/** Round-type label — R fitzRoy round.type parity. */
export function roundTypeLabel(roundType: RoundType): "Regular" | "Finals"
```

Deviation from plan's sketch: uses `roundType: RoundType` directly rather than `seasonLastHaRound?: number`, because `roundType` is always on `Match` and is already classified — no season table lookup needed at the call site.

---

## Step 4: Implementation (ran — conditions met)

**Condition 1** — no conflicting-canonical venue entries: CONFIRMED (0 conflicts).
**Condition 2** — round helpers need nothing beyond inputs already available to callers: CONFIRMED (`roundNumber`, `roundName`, `roundType` are always on `Match`).

### Files added / changed

| File | Change |
|---|---|
| `src/lib/round-labels.ts` | New — `roundLabel`, `roundAbbreviation`, `roundTypeLabel` |
| `src/index.ts` | Export the three helpers |
| `test/lib/round-labels.test.ts` | 14 unit tests covering all branches |
| `CHANGELOG.md` | Added entry under `[Unreleased]` |

### Quality gate

```
npm run typecheck  → exit 0 (no errors)
npx biome check src/ test/  → 4 pre-existing warnings in fryzigg test (noNonNullAssertion), 0 errors, 0 new issues
npm run test  → 510/510 passed (50 test files)
```

---

## R_PARITY.md update note

`docs/R_PARITY.md` should gain a row: **`round.abbreviation`** parity is now closed — `roundAbbreviation(m.roundNumber, m.roundName, m.roundType)` produces the equivalent of R fitzRoy's `round.abbreviation` column. Same for `round.name` → `roundLabel` and `round.type` → `roundTypeLabel`.

---

## Open questions

1. **AFL-MCP naming convention**: AFL-MCP intentionally uses shorter canonical team names (R-package style). If AFL-MCP were to adopt our `normaliseTeamName`, it would need to accept that canonicals differ (e.g. "Geelong Cats" not "Geelong"). The consumer would need to decide which convention it wants. This is out of scope for this plan.

2. **`roundName === null` finals fallback precision**: When `roundName` is null and `roundType === "Finals"`, our helpers return `"Finals N"` / `"F{N}"` where N is the raw round number. This is the same approach AFL-MCP uses. A caller that wants precise labels ("Semi Finals" etc.) from raw round numbers on Squiggle data would need to pass in `seasonLastHaRound` — that's a future extension, not blocked by this plan.

3. **Venue naming-rights churn**: Our venue map now has no AFL-MCP gap, but sponsor names change annually. "Ninja Stadium" / "Summit Sports Park" is the newest entry. This venue and Barossa Park should be added to the new-AFL-season checklist (per plan maintenance notes).

4. **`roundCode` vs `roundAbbreviation`**: The existing `Match.roundCode` field uses a different format (`"R1"`, `"QF"`, `"GF"`) than `roundAbbreviation` produces (`"Rd 1"`, `"SF"`, `"GF"`). These coexist without conflict — `roundCode` is our internal normalised code; `roundAbbreviation` is the R fitzRoy parity helper. Consumers wanting R parity should use the helper, not `roundCode`.
