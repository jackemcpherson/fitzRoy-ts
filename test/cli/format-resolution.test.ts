import { describe, expect, it } from "vite-plus/test";
import { resolveFormat } from "../../src/cli/formatters/index";

describe("resolveFormat", () => {
  it("returns json when --json flag is set", () => {
    expect(resolveFormat({ json: true })).toBe("json");
  });

  it("returns csv when --csv flag is set", () => {
    expect(resolveFormat({ csv: true })).toBe("csv");
  });

  it("gives --json priority over --csv", () => {
    expect(resolveFormat({ json: true, csv: true })).toBe("json");
  });

  it("returns format when --format is explicitly set", () => {
    expect(resolveFormat({ format: "csv" })).toBe("csv");
    expect(resolveFormat({ format: "json" })).toBe("json");
    expect(resolveFormat({ format: "table" })).toBe("table");
  });

  it("gives shorthand flags priority over --format", () => {
    expect(resolveFormat({ json: true, format: "csv" })).toBe("json");
    expect(resolveFormat({ csv: true, format: "table" })).toBe("csv");
  });

  it("defaults to json when stdout is not a TTY", () => {
    expect(resolveFormat({}, false)).toBe("json");
  });

  it("defaults to table when stdout is a TTY", () => {
    expect(resolveFormat({}, true)).toBe("table");
  });

  it("ignores invalid --format values and falls through to TTY detection", () => {
    expect(resolveFormat({ format: "invalid" }, true)).toBe("table");
  });
});
