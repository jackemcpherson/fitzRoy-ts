/**
 * Round label derivation helpers — R fitzRoy `round.name` / `round.abbreviation` /
 * `round.type` parity.
 *
 * All three functions are pure: they operate only on data already present on
 * every {@link Match} row (`roundNumber`, `roundName`, `roundType`). No live
 * data, no season table lookup required.
 *
 * These close the gap observed in AFL-MCP (`github.com/jackemcpherson/AFL-MCP`),
 * which hand-rolls equivalent helpers (`deriveRound`, `deriveRoundAbbreviation`,
 * `deriveRoundType` in `src/sync/upserts.ts`) because fitzRoy-ts did not export
 * them. The R fitzRoy package emits these as fields on every result row;
 * this module provides the same derivation as exported helpers.
 *
 * @example
 * ```ts
 * roundLabel(1, "Round 1", "HomeAndAway");          // "Round 1"
 * roundLabel(0, null, "HomeAndAway");               // "Opening Round"
 * roundLabel(1, null, "Finals");                    // "Finals 1"
 *
 * roundAbbreviation(1, "Round 1", "HomeAndAway");   // "Rd 1"
 * roundAbbreviation(0, "Opening Round", "HomeAndAway"); // "OR"
 * roundAbbreviation(0, null, "HomeAndAway");        // "OR"
 * roundAbbreviation(4, "Grand Final", "Finals");    // "GF"
 * roundAbbreviation(1, null, "Finals");             // "F1"
 *
 * roundTypeLabel("HomeAndAway");                    // "Regular"
 * roundTypeLabel("Finals");                         // "Finals"
 * ```
 */

import type { RoundType } from "../types";

/**
 * Known round name → abbreviation map (AFL standard short codes, mirroring
 * R fitzRoy `round.abbreviation`). Keys are the exact strings returned by
 * the AFL API `roundName` field.
 */
const ROUND_ABBREV_MAP: ReadonlyMap<string, string> = new Map([
  ["Opening Round", "OR"],
  ["Wildcard", "WC"],
  ["Qualifying Finals", "QF"],
  ["Elimination Finals", "EF"],
  ["Semi Finals", "SF"],
  ["Preliminary Finals", "PF"],
  ["Grand Final", "GF"],
]);

/**
 * Pattern for "Finals Week N" labels (some competitions/years).
 * e.g. "Finals Week 1" → "FW1".
 */
const FINALS_WEEK_RE = /^Finals Week (\d+)$/;

/**
 * Returns the long-form round label, mirroring R fitzRoy's `round.name`.
 *
 * When `roundName` is already populated (AFL API / AFL Tables / FootyWire),
 * it is returned unchanged. For sources that do not publish round names
 * (`roundName === null`), a label is synthesised from `roundNumber` and
 * `roundType`.
 *
 * @param roundNumber - Round number from the data source (0 = Opening Round in 2024+).
 * @param roundName   - Raw round name from the data source, or null if not published.
 * @param roundType   - Match round classification ("HomeAndAway" | "Finals").
 * @returns Human-readable round label.
 *
 * @example
 * ```ts
 * roundLabel(1, "Round 1", "HomeAndAway");   // "Round 1"
 * roundLabel(0, null, "HomeAndAway");        // "Opening Round"
 * roundLabel(1, null, "HomeAndAway");        // "Round 1"
 * roundLabel(1, null, "Finals");             // "Finals 1"
 * ```
 */
export function roundLabel(
  roundNumber: number,
  roundName: string | null,
  roundType: RoundType,
): string {
  if (roundName !== null) return roundName;
  if (roundNumber === 0) return "Opening Round";
  if (roundType === "Finals") return `Finals ${roundNumber}`;
  return `Round ${roundNumber}`;
}

/**
 * Returns the short-form round abbreviation, mirroring R fitzRoy's
 * `round.abbreviation`.
 *
 * When `roundName` is available, maps known names to AFL standard codes:
 * - Regular rounds: `"Rd N"` (e.g. `"Rd 1"`, `"Rd 23"`)
 * - Special rounds: `"OR"` (Opening Round), `"WC"` (Wildcard)
 * - Finals weeks: `"FW1"`, `"FW2"`, … (when named "Finals Week N")
 * - Named finals: `"QF"`, `"EF"`, `"SF"`, `"PF"`, `"GF"`
 *
 * Falls back to synthesised codes when `roundName === null`:
 * - Round 0, H&A: `"OR"`
 * - Round N, H&A: `"Rd N"`
 * - Any finals round: `"F{roundNumber}"` (imprecise but always available)
 *
 * @param roundNumber - Round number from the data source.
 * @param roundName   - Raw round name from the data source, or null if not published.
 * @param roundType   - Match round classification ("HomeAndAway" | "Finals").
 * @returns Short AFL round abbreviation.
 *
 * @example
 * ```ts
 * roundAbbreviation(1,  "Round 1",   "HomeAndAway"); // "Rd 1"
 * roundAbbreviation(0,  "Opening Round", "HomeAndAway"); // "OR"
 * roundAbbreviation(0,  null,        "HomeAndAway"); // "OR"
 * roundAbbreviation(4,  "Grand Final", "Finals");    // "GF"
 * roundAbbreviation(1,  null,        "Finals");      // "F1"
 * ```
 */
export function roundAbbreviation(
  roundNumber: number,
  roundName: string | null,
  roundType: RoundType,
): string {
  if (roundName !== null) {
    const known = ROUND_ABBREV_MAP.get(roundName);
    if (known !== undefined) return known;

    const fwMatch = FINALS_WEEK_RE.exec(roundName);
    if (fwMatch !== null) {
      const n = fwMatch[1];
      if (n !== undefined) return `FW${n}`;
    }

    const rdMatch = /^Round (\d+)$/.exec(roundName);
    if (rdMatch !== null) {
      const n = rdMatch[1];
      if (n !== undefined) return `Rd ${n}`;
    }
  }

  if (roundNumber === 0) return "OR";
  if (roundType === "Finals") return `F${roundNumber}`;
  return `Rd ${roundNumber}`;
}

/**
 * Maps the library's {@link RoundType} to its human-readable label,
 * mirroring R fitzRoy's `round.type` output.
 *
 * @param roundType - "HomeAndAway" | "Finals"
 * @returns `"Regular"` for home-and-away rounds; `"Finals"` for finals.
 *
 * @example
 * ```ts
 * roundTypeLabel("HomeAndAway"); // "Regular"
 * roundTypeLabel("Finals");      // "Finals"
 * ```
 */
export function roundTypeLabel(roundType: RoundType): "Regular" | "Finals" {
  return roundType === "HomeAndAway" ? "Regular" : "Finals";
}
