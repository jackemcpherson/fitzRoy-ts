/**
 * Zero-dependency fuzzy text matching utilities.
 *
 * Uses Levenshtein distance for typo tolerance and a multi-strategy
 * scoring system for flexible candidate ranking. All functions are
 * pure and use only Web Standard APIs.
 */

/** A scored fuzzy match result. Lower score = better match. */
export interface FuzzyMatch<T> {
  readonly item: T;
  readonly score: number;
}

/** Options for {@link fuzzySearch}. */
export interface FuzzySearchOptions {
  /** Maximum number of results to return. @default 10 */
  readonly maxResults?: number;
  /** Maximum normalised Levenshtein distance (0–1) to accept. @default 0.4 */
  readonly threshold?: number;
}

/**
 * Compute the Levenshtein edit distance between two strings.
 *
 * Uses an iterative single-row DP approach for O(min(n,m)) space.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns The minimum number of single-character edits.
 */
export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;

  if (la === 0) return lb;
  if (lb === 0) return la;

  // Ensure `b` is the shorter string for space efficiency
  if (la < lb) return levenshteinDistance(b, a);

  const row = Array.from({ length: lb + 1 }, (_, i) => i);

  for (let i = 1; i <= la; i++) {
    let prev = i;
    for (let j = 1; j <= lb; j++) {
      const current = row[j - 1];
      const rowJ = row[j];
      if (current === undefined || rowJ === undefined) continue;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(rowJ + 1, prev + 1, current + cost);
      row[j - 1] = prev;
      prev = val;
    }
    row[lb] = prev;
  }

  return row[lb] ?? 0;
}

/**
 * Search candidates using a multi-strategy fuzzy matching algorithm.
 *
 * Scoring strategy (ascending — lower is better):
 * - `0.0` — exact case-insensitive match
 * - `0.1` — candidate starts with the query
 * - `0.3` — candidate contains the query
 * - `0.4–1.0` — proportional Levenshtein distance within threshold
 *
 * @param query - The search term.
 * @param candidates - Items to search through.
 * @param keySelector - Extracts the searchable string from each candidate.
 * @param options - Optional max results and distance threshold.
 * @returns Matched candidates sorted by score (ascending), then alphabetically.
 *
 * @example
 * ```ts
 * const teams = [{ name: "Carlton" }, { name: "Collingwood" }];
 * fuzzySearch("carl", teams, t => t.name);
 * // [{ item: { name: "Carlton" }, score: 0.1 }]
 * ```
 */
export function fuzzySearch<T>(
  query: string,
  candidates: readonly T[],
  keySelector: (item: T) => string,
  options?: FuzzySearchOptions,
): FuzzyMatch<T>[] {
  const maxResults = options?.maxResults ?? 10;
  const threshold = options?.threshold ?? 0.4;
  const lowerQuery = query.toLowerCase();
  const results: FuzzyMatch<T>[] = [];

  for (const item of candidates) {
    const key = keySelector(item).toLowerCase();

    if (key === lowerQuery) {
      results.push({ item, score: 0 });
      continue;
    }

    if (key.startsWith(lowerQuery)) {
      results.push({ item, score: 0.1 });
      continue;
    }

    if (key.includes(lowerQuery)) {
      results.push({ item, score: 0.3 });
      continue;
    }

    const maxLen = Math.max(lowerQuery.length, key.length);
    if (maxLen === 0) continue;

    const distance = levenshteinDistance(lowerQuery, key);
    const normalised = distance / maxLen;

    if (normalised <= threshold) {
      // Map normalised distance (0–threshold) into the 0.4–1.0 score range
      const score = 0.4 + (normalised / threshold) * 0.6;
      results.push({ item, score });
    }
  }

  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return keySelector(a.item).localeCompare(keySelector(b.item));
  });

  return results.slice(0, maxResults);
}
