/**
 * Tests for the core `disambiguate` helper in `src/cli/resolvers.ts`.
 *
 * The helper is tested directly (it is exported for this purpose).
 * Modelled on test/cli/validation.test.ts — sentence-style names,
 * pure-function error assertions.
 */

import { describe, expect, it } from "vitest";
import { disambiguate } from "../../src/cli/resolvers";

const ALL_LABELS = ["Carlton", "Richmond", "Collingwood"];

const OPTION_CARLTON = { value: "5", label: "Carlton", score: 0.05 };
const OPTION_RICHMOND = { value: "10", label: "Richmond", score: 0.25 };
const OPTION_COLLINGWOOD = { value: "4", label: "Collingwood", score: 0.3 };

describe("disambiguate", () => {
  it("throws listing valid options when no match is found", async () => {
    await expect(disambiguate("UnknownFC", [], ALL_LABELS, "team", false)).rejects.toThrow(
      'No team found for "UnknownFC"',
    );

    await expect(disambiguate("UnknownFC", [], ALL_LABELS, "team", false)).rejects.toThrow(
      "Carlton, Richmond, Collingwood",
    );
  });

  it("returns the best match silently when the score is below 0.2 (confident match)", async () => {
    // score 0.05 < 0.2 → accepted without prompting regardless of TTY
    const result = await disambiguate(
      "Carl",
      [OPTION_CARLTON, OPTION_RICHMOND],
      ALL_LABELS,
      "team",
      false,
    );
    expect(result).toBe("5");
  });

  it("returns the only candidate when exactly one option is present", async () => {
    // options.length === 1 → early-return even with an ambiguous score
    const result = await disambiguate("Rich", [OPTION_RICHMOND], ALL_LABELS, "team", false);
    expect(result).toBe("10");
  });

  it("throws listing all candidate labels when ambiguous and not in a TTY", async () => {
    // score >= 0.2, multiple options, isTTY=false → error instead of silent guess
    const err = await disambiguate(
      "C",
      [OPTION_RICHMOND, OPTION_COLLINGWOOD],
      ALL_LABELS,
      "team",
      false,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain("Richmond");
    expect(message).toContain("Collingwood");
    expect(message).toContain("more specific");
  });
});
