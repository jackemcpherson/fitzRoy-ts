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
