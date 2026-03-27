import { describe, expect, it } from "vitest";
import { fuzzySearch, levenshteinDistance } from "../../src/lib/fuzzy";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns the length of the other string when one is empty", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });

  it("handles single character differences", () => {
    expect(levenshteinDistance("cat", "car")).toBe(1);
    expect(levenshteinDistance("cat", "cats")).toBe(1);
    expect(levenshteinDistance("cat", "at")).toBe(1);
  });

  it("handles transpositions as two edits", () => {
    expect(levenshteinDistance("ab", "ba")).toBe(2);
  });

  it("computes correct distance for common typos", () => {
    expect(levenshteinDistance("carlton", "calrton")).toBe(2);
    expect(levenshteinDistance("geelong", "gelong")).toBe(1);
    expect(levenshteinDistance("essendon", "essenden")).toBe(1);
  });

  it("handles completely different strings", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });
});

describe("fuzzySearch", () => {
  const teams = [
    { name: "Adelaide Crows" },
    { name: "Brisbane Lions" },
    { name: "Carlton" },
    { name: "Collingwood" },
    { name: "Essendon" },
    { name: "Geelong Cats" },
    { name: "Melbourne" },
    { name: "Richmond" },
    { name: "St Kilda" },
    { name: "Sydney Swans" },
  ];
  const key = (t: { name: string }) => t.name;

  it("finds exact case-insensitive matches with score 0", () => {
    const results = fuzzySearch("carlton", teams, key);
    expect(results[0]).toEqual({ item: { name: "Carlton" }, score: 0 });
  });

  it("finds starts-with matches with score 0.1", () => {
    const results = fuzzySearch("Carl", teams, key);
    expect(results[0]?.score).toBe(0.1);
    expect(results[0]?.item.name).toBe("Carlton");
  });

  it("finds contains matches with score 0.3", () => {
    const results = fuzzySearch("elong", teams, key);
    expect(results[0]?.score).toBe(0.3);
    expect(results[0]?.item.name).toBe("Geelong Cats");
  });

  it("finds typo matches via Levenshtein with score > 0.4", () => {
    const results = fuzzySearch("Calrton", teams, key);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.item.name).toBe("Carlton");
    expect(results[0]?.score).toBeGreaterThan(0.3);
    expect(results[0]?.score).toBeLessThan(1.0);
  });

  it("returns empty array for no matches", () => {
    const results = fuzzySearch("XYZZY", teams, key);
    expect(results).toEqual([]);
  });

  it("respects maxResults option", () => {
    const results = fuzzySearch("e", teams, key, { maxResults: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("sorts by score ascending, then alphabetically", () => {
    const items = [{ name: "Melbourne" }, { name: "Melton" }];
    const results = fuzzySearch("mel", items, key);
    // Both start with "mel", both score 0.1, alphabetical order
    expect(results[0]?.item.name).toBe("Melbourne");
    expect(results[1]?.item.name).toBe("Melton");
  });

  it("excludes matches above threshold", () => {
    const results = fuzzySearch("Carlton", teams, key, { threshold: 0.01 });
    // Only exact match should pass with such a tight threshold
    expect(results.length).toBe(1);
    expect(results[0]?.item.name).toBe("Carlton");
  });

  it("handles empty candidates", () => {
    const results = fuzzySearch("test", [], key);
    expect(results).toEqual([]);
  });

  it("handles empty query", () => {
    const results = fuzzySearch("", teams, key);
    // Empty string is contained in everything, so all should match
    expect(results.length).toBeGreaterThan(0);
  });
});
