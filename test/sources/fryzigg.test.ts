import { describe, expect, it } from "vitest";
import { ScrapeError } from "../../src/lib/errors";
import { fetchFryziggStats } from "../../src/sources/fryzigg";

describe("fetchFryziggStats", () => {
  it("returns an error Result explaining RDS limitation", () => {
    const result = fetchFryziggStats();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ScrapeError);
      expect(result.error.message).toContain("RDS binary format");
      expect(result.error.source).toBe("fryzigg");
    }
  });
});
