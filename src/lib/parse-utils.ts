/**
 * Shared parsing utilities for scraper transforms.
 */

/** Parse an integer from scraped text, returning null if unparseable. */
export function safeInt(text: string): number | null {
  const cleaned = text.replace(/[^0-9-]/g, "").trim();
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse an integer from scraped text, defaulting to 0 for blank cells where
 * the source uses blank-as-zero (e.g. AFL Tables prints blank for scoreless
 * stats). Use this for columns the source *does* track but renders blankly
 * when zero, so the result aligns with afl-api / footywire (which return 0).
 * Reserve {@link safeInt} (returns null) for columns the source doesn't
 * track at all.
 */
export function safeIntOrZero(text: string): number {
  const cleaned = text.replace(/[^0-9-]/g, "").trim();
  if (!cleaned) return 0;
  const n = Number.parseInt(cleaned, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Parse an integer from scraped text, returning 0 if unparseable. */
export function parseIntOr0(text: string): number {
  const n = Number.parseInt(text.replace(/[^0-9-]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Parse a float from scraped text, returning 0 if unparseable. */
export function parseFloatOr0(text: string): number {
  const n = Number.parseFloat(text.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}
