# Design Report 024: Squiggle Model Predictions (Tips)

**Probed:** 2026-07-02  
**Baseline commit:** 05d088c (no drift detected — `git diff --stat 05d088c..HEAD -- src/sources/squiggle.ts src/sources/adapters/ src/types.ts` produced no output)

---

## 1. Probe Findings

### 1.1 Endpoint Status

`https://api.squiggle.com.au/?q=tips` is live, unauthenticated, and returns JSON.
The `year` and `round` query parameters filter results; both can be omitted
for bulk access. The User-Agent policy is already implemented in `SquiggleClient`
(`src/sources/squiggle.ts:21,47`).

### 1.2 Field Inventory

All 21 fields are present on every tip row. Three fields are `null` pre-game and
populated post-game:

| Field | Type (raw) | Nullable | Description |
|---|---|---|---|
| `gameid` | `number` | no | Squiggle game identifier |
| `year` | `number` | no | Season year |
| `round` | `number` | no | Round number |
| `date` | `string` | no | Local datetime `"YYYY-MM-DD HH:mm:ss"` |
| `venue` | `string` | no | Venue name (Squiggle spelling) |
| `hteam` | `string` | no | Home team (Squiggle name, not canonical) |
| `ateam` | `string` | no | Away team (Squiggle name) |
| `hteamid` | `number` | no | Squiggle home team ID |
| `ateamid` | `number` | no | Squiggle away team ID |
| `sourceid` | `number` | no | Model ID (stable across seasons) |
| `source` | `string` | no | Model name (string, may change) |
| `updated` | `string` | no | Last update datetime |
| `tip` | `string` | no | Tipped winner (Squiggle name) |
| `tipteamid` | `number` | no | Squiggle ID of tipped team |
| `confidence` | `string(numeric)` | no | Win probability for tipped team (0–100) |
| `hconfidence` | `string(numeric)` | no | Win probability for home team; `< 50` when away tipped |
| `hmargin` | `string(numeric)` | no | Predicted home margin (negative = away advantage) |
| `margin` | `string(numeric)` | no | Absolute predicted winning margin for tipped team |
| `err` | `string(numeric)` | **yes** | Absolute error post-game (null pre-game) |
| `bits` | `string(numeric)` | **yes** | Log-score (bits) post-game; can be negative (null pre-game) |
| `correct` | `number` (0/1) | **yes** | 1 = tip correct, 0 = incorrect (null pre-game) |

**Margin semantics**: `hmargin` is always from the home team's perspective
(`"-16.25"` means home team loses by 16.25). `margin` is always positive and
represents the predicted winning margin of the tipped team. These two fields
are mirror images when the away team is tipped; they are equal when the home
team is tipped.

**Confidence semantics**: `confidence` is the tipped team's win probability;
`hconfidence` is always for the home team regardless of who is tipped. When
the away team is tipped, `confidence + hconfidence ≈ 100`.

**All numeric values are API strings** — `"79.82"` not `79.82`. The Zod schema
must coerce or validate as string-then-parsed.

### 1.3 Pre-game vs Post-game Comparison

| State | `correct` | `err` | `bits` |
|---|---|---|---|
| Pre-game (upcoming) | `null` | `null` | `null` |
| Post-game (complete) | `0` or `1` | `"20.75"` (example) | `"0.4227"` (positive = good tip; negative = bad tip) |

The `correct` field is always present in the JSON but its value is `null` before
the game is played. This matches the `MatchStatus="Upcoming"` concept.

### 1.4 Model Inventory (2026 R1, 31 models)

| sourceid | source |
|---|---|
| 1 | Squiggle |
| 4 | Matter of Stats |
| 5 | Punters |
| 7 | PlusSixOne |
| 8 | Aggregate |
| 9 | Graft |
| 10 | Stattraction |
| 11 | Live Ladders |
| 14 | Massey Ratings |
| 15 | AFLalytics |
| 17 | AFL Lab |
| 21 | s10 |
| 22 | Glicko Ratings |
| 23 | ZaphBot |
| 24 | The Cruncher |
| 25 | Cheap Stats |
| 26 | Wheelo Ratings |
| 27 | The Footycast |
| 28 | Elo Predicts! |
| 29 | Drop Kick Data |
| 31 | The Wooden Finger |
| 32 | AFL Scorigami |
| 33 | Hyperion |
| 34 | Don't Blame the Data |
| 35 | footycharts |
| 36 | What Snoo Thinks |
| 37 | Winnable |
| 38 | Informed Stats |
| 39 | HBin |
| 40 | In The Game |
| 41 | Holy Grail Ratings |

Model count has grown over time: 2017 R1 returned 81 tips (~9 models),
2019 R1 returned 162 tips (~18 models), 2026 R1 returns 277 tips (31 models).
Some models that appeared in 2019 are absent in 2026 (e.g. "The Arc", "HPN",
"Fat Stats"), confirming that models can come and go. The `sourceid` integer
appears stable; `source` string names should be treated as display labels.

### 1.5 Coverage Range

| Year | R1 tip count | Status |
|---|---|---|
| 2016 | 0 | No data |
| 2017 | 81 | Earliest confirmed year |
| 2018 | 126 | ✓ |
| 2019 | 162 | ✓ |
| 2025 | 252 (R18) | ✓ |
| 2026 | 277 (R1) | ✓ (current) |

**AFLM only.** The `comp` query parameter does not reliably filter by AFLW — the
same AFLM game IDs appear regardless of the parameter value. Squiggle's tips
data covers AFLM starting from 2017.

### 1.6 Team-Name Discrepancies

Six of eighteen teams use non-canonical names. All six already have entries in
`src/lib/team-mapping.ts` and resolve correctly via `normaliseTeamName`:

| Squiggle name | Canonical (AFL API) |
|---|---|
| `"Adelaide"` | `"Adelaide Crows"` |
| `"Geelong"` | `"Geelong Cats"` |
| `"Gold Coast"` | `"Gold Coast Suns"` |
| `"Greater Western Sydney"` | `"GWS Giants"` |
| `"Sydney"` | `"Sydney Swans"` |
| `"West Coast"` | `"West Coast Eagles"` |

The `tip` field also uses Squiggle names, so it requires normalization too.
The remaining 12 teams (`Brisbane Lions`, `Carlton`, `Collingwood`, `Essendon`,
`Fremantle`, `Hawthorn`, `Melbourne`, `North Melbourne`, `Port Adelaide`,
`Richmond`, `St Kilda`, `Western Bulldogs`) pass through unchanged.

### 1.7 Representative Sanitized Samples

**Post-game (2025 R18, Carlton vs Brisbane Lions):**

```json
{
  "gameid": 37237,
  "year": 2025,
  "round": 18,
  "date": "2025-07-10 19:30:00",
  "venue": "Docklands",
  "hteam": "Carlton",
  "ateam": "Brisbane Lions",
  "hteamid": 3,
  "ateamid": 2,
  "sourceid": 1,
  "source": "Squiggle",
  "updated": "2025-07-10 22:12:04",
  "tip": "Brisbane Lions",
  "tipteamid": 2,
  "confidence": "67.02",
  "hconfidence": "32.98",
  "hmargin": "-16.25",
  "margin": "16.25",
  "err": "20.75",
  "bits": "0.4227",
  "correct": 1
}
```

**Pre-game (2026 R18, upcoming):**

```json
{
  "gameid": 38645,
  "year": 2026,
  "round": 18,
  "date": "2026-07-11 20:10:00",
  "venue": "Adelaide Oval",
  "hteam": "Adelaide",
  "ateam": "Gold Coast",
  "hteamid": 1,
  "ateamid": 8,
  "sourceid": 1,
  "source": "Squiggle",
  "updated": "2026-06-28 19:41:10",
  "tip": "Adelaide",
  "tipteamid": 1,
  "confidence": "64.44",
  "hconfidence": "64.44",
  "hmargin": "13.82",
  "margin": "13.82",
  "err": null,
  "bits": null,
  "correct": null
}
```

---

## 2. Proposed Domain Surface

### 2.1 `Prediction` Interface (`src/types.ts`)

```ts
/**
 * A single model's pre-game or post-game prediction for one AFL match.
 *
 * One row = one (game, model) pair. Pre-game rows have `err`, `bits`, and
 * `correct` as null; post-game rows have all three populated.
 *
 * Team names are canonicalized via `normaliseTeamName` — e.g. Squiggle's
 * `"Adelaide"` becomes `"Adelaide Crows"`.
 *
 * Source is always `"squiggle"` — this type has no multi-source variant.
 */
export interface Prediction {
  /** Squiggle game identifier (joins to SquiggleGame.id). */
  readonly gameId: number;
  readonly season: number;
  readonly roundNumber: number;
  /** Squiggle local datetime, e.g. "2025-07-10 19:30:00". */
  readonly date: string;
  readonly venue: string;
  /** Canonical home team name. */
  readonly homeTeam: string;
  /** Canonical away team name. */
  readonly awayTeam: string;
  /** Numeric model ID — stable across seasons. */
  readonly modelId: number;
  /** Model display name — may change between seasons. */
  readonly modelName: string;
  /** Canonical name of tipped winner. */
  readonly tip: string;
  /** Win probability for tipped team (0–100). */
  readonly confidence: number;
  /** Win probability for home team (0–100); < 50 when away team is tipped. */
  readonly homeConfidence: number;
  /**
   * Predicted margin from home team's perspective. Negative = away team
   * expected to win. E.g. `-16.25` means away win by 16.25 points.
   */
  readonly homeMargin: number;
  /**
   * Absolute predicted winning margin for the tipped team. Always positive.
   * Equal to `Math.abs(homeMargin)`.
   */
  readonly margin: number;
  /**
   * Absolute prediction error post-game (actual margin - predicted margin,
   * unsigned). Null before the game is played.
   */
  readonly err: number | null;
  /**
   * Log-score in bits. Positive = better than chance; negative = worse than
   * chance. Null before the game is played.
   */
  readonly bits: number | null;
  /**
   * Whether the tip was correct. Null before the game is played.
   * 0 = wrong, 1 = correct (kept as number to match upstream literally;
   * a boolean alias `isCorrect` can be derived downstream).
   */
  readonly correct: 0 | 1 | null;
  readonly source: DataSource; // always "squiggle"
}
```

**On row shape vs pivot**: per-model per-game rows are canonical. 31 models
× 9 games = ~280 rows per round; that's the natural shape for downstream
model comparison (groupBy gameId, groupBy modelId both work). A pivoted
shape (one row per game, one column per model) would require a variable-width
type and breaks the flat-array contract of every other fetch function.

### 2.2 `PredictionQuery` (`src/types.ts`)

```ts
/** Query parameters for fetching model predictions. */
export interface PredictionQuery {
  readonly season: number;
  readonly round?: number | undefined;
  /**
   * Squiggle model name to narrow results. When omitted, all models are
   * returned. Matches against the `source` field (display name) rather than
   * `sourceid` because `sourceid` is internal to Squiggle.
   */
  readonly model?: string | undefined;
  readonly competition?: CompetitionCode | undefined;
}
```

Note: `source: DataSource` is omitted — predictions have exactly one source
(`squiggle`), matching the precedent of `CoachesVoteQuery` which also omits
`source` because `afl-coaches` is the only provider. The public function
hardcodes `source: "squiggle"` internally when constructing the `DispatchQuery`.

### 2.3 `PredictionSource` Capability Interface (`src/sources/adapters/capabilities.ts`)

```ts
/** A source that can fetch model predictions (tips). */
export interface PredictionSource extends CapabilityAdapter {
  fetchPredictions(query: PredictionQuery): Promise<Result<Prediction[], Error>>;
}
```

### 2.4 Registry Entry (`src/sources/adapters/registry.ts`)

```ts
export const predictionRegistry = new CapabilityRegistry<PredictionSource>("squiggle");
```

Default source is `"squiggle"` — there are no alternative sources, but the
registry is still used so the `dispatch` pattern is preserved and the error
path (wrong source) is handled uniformly.

### 2.5 Coverage Map (`src/sources/adapters/squiggle.ts` adapter)

```ts
class SquigglePredictionSource implements PredictionSource {
  readonly id: DataSource = "squiggle";
  readonly coverage: CoverageMap = new Map([
    ["AFLM", { minSeason: 2017 }],
    // AFLW: not covered (Squiggle's q=tips is AFLM-only)
  ]);

  async fetchPredictions(query: PredictionQuery): Promise<Result<Prediction[], Error>> {
    // 1. fetchJson with q=tips, year, round
    // 2. SquiggleTipsResponseSchema.safeParse
    // 3. transform rows: normaliseTeamName on hteam/ateam/tip, parse numeric strings
    // 4. optional model filter (client-side, post-fetch)
    // 5. return ok(predictions)
  }
}
```

### 2.6 Public API Function (`src/api/predictions.ts`)

```ts
/**
 * Fetch model predictions (tips) for an AFL season.
 *
 * Always uses Squiggle as the data source. Coverage: AFLM from 2017.
 *
 * @example
 * ```ts
 * // All models, round 1 of 2026
 * await fetchPredictions({ season: 2026, round: 1 });
 *
 * // One model across a full season
 * await fetchPredictions({ season: 2025, model: "Squiggle" });
 * ```
 */
export async function fetchPredictions(
  query: PredictionQuery,
): Promise<Result<Prediction[], Error>> {
  const dispatchQuery: DispatchQuery = {
    source: "squiggle",
    season: query.season,
    competition: query.competition ?? "AFLM",
  };
  const adapterR = dispatch(predictionRegistry, "predictions", dispatchQuery);
  return Result.flatMapAsync(adapterR, (a) => a.fetchPredictions(query));
}
```

### 2.7 Zod Schema Location

Extend `src/lib/squiggle-validation.ts` with `SquiggleTipSchema` and
`SquiggleTipsResponseSchema` following the same pattern as the existing
`SquiggleGameSchema`. Numeric-string fields (`confidence`, `hconfidence`,
`hmargin`, `margin`, `err`, `bits`) should be validated as `z.string()` at
the boundary and parsed to `number` in the transform layer — do not use
`z.coerce.number()` on Squiggle data because it silently swallows bad values;
parse explicitly with `Number(value)` and assert `Number.isFinite`.

---

## 3. CLI Recommendation

**Recommendation: library-only first release (option a).**

The CONTEXT.md idiom — "six commands, drill in by adding flags" — applies to
operations that serve multiple sources and have a natural cross-source
comparison story. The six existing commands (`team`, `player`, `match`,
`stats`, `ladder`, `awards`) are all multi-source or multi-mode verbs where
the CLI's consolidation layer adds real value. Predictions are Squiggle-only;
there is no `--source` flag to expose, and the cross-model comparison work
happens downstream in the user's analysis — the library just needs to return
a flat `Prediction[]` array.

**Argument for library-only first**: The `Prediction` type is the library's
first non-actuals domain entity (no match score, no player stats — purely
probabilistic). A library-only release lets the type design settle before a
CLI surface is locked in. Callers can already use `JSON.stringify` on the raw
`fetchPredictions` result, which is how most tipping-tool integrations work.

**When to add a CLI verb**: Once the build plan is shipped and at least one
external use-case has driven the query shape, add a `predictions` command (the
seventh, dedicated, not folded into `match`). The `--model` flag and `--json`
output are the natural first flags. Do NOT fold predictions into `match
--predictions` — predictions have a different shape (per-model, not per-match),
a different source, and a different temporal semantics (predictions exist before
games are played, alongside Upcoming matches, so the combination would produce
a confusingly mixed result type).

---

## 4. Open Questions

1. **Is `correct: 0 | 1 | null` the right shape, or should the transform
   produce `isCorrect: boolean | null`?** The upstream value is an integer
   flag; the rest of the codebase uses `boolean` for flags. Recommend
   `isCorrect: boolean | null` in the canonical `Prediction` type for
   consistency, with the Zod schema accepting `z.number().nullable()` at the
   boundary and the transform coercing `1 → true, 0 → false`.

2. **Should `model` in `PredictionQuery` match by `sourceid` (integer) or
   by `source` (display name string)?** The `sourceid` is stable; `source`
   names can change (e.g. a model renamed between seasons). The API supports
   `sourceid` as a query param: `?q=tips&year=2026&sourceid=1`. Recommend
   exposing both `model?: string` (display name, for CLI ergonomics) and
   `modelId?: number` (integer, for pipelines that track models across
   renames), with server-side filtering for `modelId` and client-side for
   `model`.

3. **Should `gameId` (Squiggle's `gameid`) be a join key to `Match.matchId`?**
   The existing `SquiggleMatchSource` already produces `matchId` values for
   Squiggle games; a cross-source join is possible but the namespaces are
   different (`SQGL_37237` vs `CD_M...`). The build plan should decide
   whether to include a `squiggleGameId` field on `Match` (preferred) or
   leave the join as a user concern.

4. **How do predictions interact with `Match.status="Upcoming"`?** A pre-game
   prediction has `correct: null`, which maps naturally to an upcoming match.
   A post-game prediction has `correct: 0 | 1`. The build plan should
   document whether `fetchPredictions` should return predictions for all states
   (caller filters by `correct !== null`) or add a `status?: "upcoming" |
   "complete"` filter.

5. **AFLW tips**: The probe found no AFLW data — the `comp` parameter did not
   change the response. Coverage should be declared as AFLM-only. If Squiggle
   adds AFLW tips in a future season, the coverage map can be extended without
   a breaking change.

6. **Pagination / bulk access**: The endpoint returns all tips for a year if
   `round` is omitted. At ~280 tips/round × 23 rounds, a full-season fetch
   returns ~6,440 rows in a single response. No pagination is needed, but the
   Zod schema should handle large arrays without degrading.

---

## 5. Build-Plan Sketch

**Files touched (no `src/` changes today — this is a spike):**

| File | Change |
|---|---|
| `src/types.ts` | Add `Prediction`, `PredictionQuery` interfaces |
| `src/lib/squiggle-validation.ts` | Add `SquiggleTipSchema`, `SquiggleTipsResponseSchema` |
| `src/sources/squiggle.ts` | Add `fetchTips(year, round?, sourceid?)` private method; export `SquigglePredictionSource` |
| `src/sources/adapters/capabilities.ts` | Add `PredictionSource` interface |
| `src/sources/adapters/registry.ts` | Add `predictionRegistry` |
| `src/sources/adapters/squiggle.ts` | Add `SquigglePredictionSource` class |
| `src/sources/adapters/index.ts` | Import and register `SquigglePredictionSource`; export `predictionRegistry` |
| `src/api/predictions.ts` | New file: `fetchPredictions` |
| `src/index.ts` | Re-export `fetchPredictions`, `Prediction`, `PredictionQuery` |
| `test/fixtures/squiggle-tips-r1-2026.json` | Fixture: 277 tip rows, 2026 R1 |
| `test/fixtures/squiggle-tips-r18-2026.json` | Fixture: pre-game tips (2026 R18 upcoming) |
| `test/lib/squiggle-validation.test.ts` | Schema unit tests (valid + invalid) |
| `test/transforms/squiggle-tips.test.ts` | Transform unit tests (team normalization, numeric parsing, correct flag) |
| `test/api/predictions.test.ts` | Integration-style tests against fixtures |
| `docs/R_PARITY.md` | Remove predictions from gap table (after ship) |

**Fixture strategy**: Capture two fixtures — one completed round (2025 R18, 252
rows) and one upcoming round (2026 R18, 198 rows). Use `vitest`'s `stub-fetch`
pattern from plan 015 — override `globalThis.fetch` to return fixture JSON;
never hit the live API in tests.

**Team-name normalization test**: Per the plan's maintenance notes, the build
must include a test mapping all 18 current clubs from Squiggle names to
canonical. The 6 divergent names above are the bug farm; the 12 pass-through
names should also be asserted to catch any future `normaliseTeamName`
regressions.

**Effort estimate**: S (half-day to one day). The plumbing is entirely
mechanical — the schema is 21 fields, the transform is trivial, and the
adapter follows the same pattern as `SquiggleMatchSource`. The open questions
above are the only non-mechanical work.

---

## 6. ADR / CONTEXT.md Constraints Honored

- **ADR-0001 (no silent fallback)**: Predictions are a squiggle-only capability.
  Requesting them from any other source returns `UnsupportedSourceError` via
  the standard `dispatch` path. No cross-source fallback is possible or
  proposed.

- **CONTEXT.md "per-capability interfaces"**: `PredictionSource` follows the
  exact same pattern as `MatchSource`, `LadderSource`, etc. — one interface per
  operation, each adapter declares its own coverage map.

- **CONTEXT.md "CLI consolidates, library stays factored"**: Library exposes
  `fetchPredictions` as a first-class function. The CLI recommendation defers
  the verb to a later iteration, consistent with the principle.

- **ADR-0002 (pre-2021 VFL out of scope)**: Not relevant (predictions are
  AFLM-only from 2017).

- **ADR-0003 (adapter loops)**: Not relevant (Squiggle tips are a single-request
  endpoint per round, no per-match loops).
