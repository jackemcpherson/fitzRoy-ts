import { describe, expect, it } from "vitest";
import { err, ok } from "../../src/lib/result";

describe("ok", () => {
  it("creates a success result with data", () => {
    const result = ok(42);
    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });
});

describe("err", () => {
  it("creates a failure result with error", () => {
    const result = err(new Error("fail"));
    expect(result.success).toBe(false);
    expect(result.error.message).toBe("fail");
  });
});
