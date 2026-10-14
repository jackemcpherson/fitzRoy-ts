/**
 * Tests for the core `disambiguate` helper in `src/cli/resolvers.ts`.
 *
 * The helper is tested directly (it is exported for this purpose).
 * Modelled on test/cli/validation.test.ts — sentence-style names,
 * pure-function error assertions.
 */

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { CliUsageError } from "../../src/cli/errors";
import { disambiguate, resolveTeamNameOrPrompt } from "../../src/cli/resolvers";

const ALL_LABELS = ["Carlton", "Richmond", "Collingwood"];

const OPTION_CARLTON = { value: "5", label: "Carlton", score: 0.05 };

const OPTION_RICHMOND = { value: "10", label: "Richmond", score: 0.25 };

const OPTION_COLLINGWOOD = { value: "4", label: "Collingwood", score: 0.3 };

describe("disambiguate", () => {
  it.effect("fails listing valid options when no match is found", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(disambiguate("UnknownFC", [], ALL_LABELS, "team", false));

      expect(error.message).toContain('No team found for "UnknownFC"');
      expect(error.message).toContain("Carlton, Richmond, Collingwood");
    }),
  );

  it.effect("returns the best match silently when the score is below 0.2 (confident match)", () =>
    Effect.gen(function* () {
      // score 0.05 < 0.2 → accepted without prompting regardless of TTY
      const result = yield* disambiguate(
        "Carl",
        [OPTION_CARLTON, OPTION_RICHMOND],
        ALL_LABELS,
        "team",
        false,
      );

      expect(result).toBe("5");
    }),
  );

  it.effect("returns the only candidate when exactly one option is present", () =>
    Effect.gen(function* () {
      // options.length === 1 → early-return even with an ambiguous score
      const result = yield* disambiguate("Rich", [OPTION_RICHMOND], ALL_LABELS, "team", false);

      expect(result).toBe("10");
    }),
  );

  it.effect("fails listing all candidate labels when ambiguous and not in a TTY", () =>
    Effect.gen(function* () {
      // score >= 0.2, multiple options, isTTY=false → error instead of silent guess
      const error = yield* Effect.flip(
        disambiguate("C", [OPTION_RICHMOND, OPTION_COLLINGWOOD], ALL_LABELS, "team", false),
      );

      expect(error).toBeInstanceOf(CliUsageError);
      expect(error.message).toContain("Richmond");
      expect(error.message).toContain("Collingwood");
      expect(error.message).toContain("more specific");
    }),
  );
});

describe("resolveTeamNameOrPrompt", () => {
  it.effect("rejects numeric identifiers on name-only paths", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(resolveTeamNameOrPrompt("30"));

      expect(error.message).toContain("team name or abbreviation");
    }),
  );
});
