import { describe, expect, it } from "vitest";
import { AflApiError, ScrapeError, ValidationError } from "../../src/lib/errors";

describe("AflApiError", () => {
  it("sets name and message", () => {
    const error = new AflApiError("unauthorized", 401);
    expect(error.name).toBe("AflApiError");
    expect(error.message).toBe("unauthorized");
    expect(error.statusCode).toBe(401);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("ScrapeError", () => {
  it("sets name, message, and source", () => {
    const error = new ScrapeError("parse failed", "footywire");
    expect(error.name).toBe("ScrapeError");
    expect(error.message).toBe("parse failed");
    expect(error.source).toBe("footywire");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("ValidationError", () => {
  it("sets name, message, and issues", () => {
    const issues = [{ path: "score", message: "required" }];
    const error = new ValidationError("invalid data", issues);
    expect(error.name).toBe("ValidationError");
    expect(error.message).toBe("invalid data");
    expect(error.issues).toEqual(issues);
    expect(error).toBeInstanceOf(Error);
  });
});
