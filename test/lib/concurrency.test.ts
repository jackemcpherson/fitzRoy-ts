import { describe, expect, it } from "vitest";
import { batchedMap } from "../../src/lib/concurrency";

describe("batchedMap", () => {
  it("processes all items and returns results in order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await batchedMap(items, async (n) => n * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects batch size by limiting concurrency", async () => {
    let maxConcurrent = 0;
    let current = 0;

    const items = [1, 2, 3, 4, 5, 6, 7];
    await batchedMap(
      items,
      async (n) => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise((resolve) => setTimeout(resolve, 10));
        current--;
        return n;
      },
      { batchSize: 3 },
    );

    expect(maxConcurrent).toBe(3);
  });

  it("handles empty input", async () => {
    const results = await batchedMap([], async (n: number) => n);
    expect(results).toEqual([]);
  });

  it("handles single item", async () => {
    const results = await batchedMap([42], async (n) => n.toString());
    expect(results).toEqual(["42"]);
  });

  it("defaults to batch size of 5", async () => {
    let maxConcurrent = 0;
    let current = 0;

    const items = Array.from({ length: 10 }, (_, i) => i);
    await batchedMap(items, async (n) => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((resolve) => setTimeout(resolve, 10));
      current--;
      return n;
    });

    expect(maxConcurrent).toBe(5);
  });

  it("applies inter-batch delay", async () => {
    const start = Date.now();
    const items = [1, 2, 3, 4];
    await batchedMap(items, async (n) => n, { batchSize: 2, delayMs: 50 });
    const elapsed = Date.now() - start;

    // Should have at least one delay between batches
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it("propagates errors from the mapping function", async () => {
    const items = [1, 2, 3];
    await expect(
      batchedMap(items, async (n) => {
        if (n === 2) throw new Error("fail");
        return n;
      }),
    ).rejects.toThrow("fail");
  });
});
