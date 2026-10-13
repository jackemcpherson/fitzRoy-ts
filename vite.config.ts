import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";

const pkg: { readonly version: string } = JSON.parse(readFileSync("./package.json", "utf-8"));

/** Paths that are not project source: build output, fixtures, archives, agent tooling. */
const IGNORED = [
  ".claude/**",
  ".agents/**",
  ".rumdl_cache/**",
  ".wrangler/**",
  "dist/**",
  "coverage/**",
  "comparison/**",
  "test/fixtures/**",
  "test/golden/__snapshots__/**",
  "tools/oxlint/anti-slop/**",
];

interface MigrationDebt {
  /** The v7 migration phase (see ADR-0004) that rewrites these files. */
  readonly phase: 2 | 4 | 5 | 6 | 7;
  readonly files: string[];
  readonly rules: string[];
}

/**
 * Files that still break a lint rule because they use the version 6 patterns
 * (Zod, `Result`, `typeof` narrowing, fetch stubs). Each v7 migration phase
 * deletes its entries. The list must be empty before v7.0.0 ships.
 */
const MIGRATION_DEBT: readonly MigrationDebt[] = [
  {
    // The parsing boundary itself; phase 4 decodes inside the HTTP service.
    phase: 4,
    files: ["src/lib/decode.ts"],
    rules: ["anti-slop/no-unknown-parameters"],
  },
  {
    phase: 4,
    files: ["src/lib/date-utils.ts"],
    rules: ["anti-slop/no-runtime-typeof"],
  },
  {
    phase: 4,
    files: ["src/sources/adapters/afl-tables.ts", "src/sources/fryzigg.ts"],
    rules: ["anti-slop/require-safety-comment-for-type-assertion"],
  },
  {
    phase: 4,
    files: ["src/sources/afl-tables.ts", "src/sources/match-coaches.ts"],
    rules: ["anti-slop/no-known-value-widening"],
  },
  {
    phase: 4,
    files: ["src/sources/footywire.ts"],
    rules: [
      "anti-slop/no-known-value-widening",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 5,
    files: ["src/api/awards.ts"],
    rules: ["anti-slop/require-safety-comment-for-type-assertion"],
  },
  {
    phase: 6,
    files: ["src/cli.ts", "src/cli/error-boundary.ts"],
    rules: ["anti-slop/no-unknown-parameters"],
  },
  {
    phase: 6,
    files: ["src/cli/alias-resolution.ts"],
    rules: ["anti-slop/no-known-value-widening"],
  },
  {
    phase: 6,
    files: ["src/cli/command-builder.ts", "src/cli/formatters/index.ts"],
    rules: [
      "anti-slop/no-unsafe-dictionary-type",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 6,
    files: [
      "src/cli/commands/awards.ts",
      "src/cli/commands/ladder.ts",
      "src/cli/commands/player.ts",
      "src/cli/commands/stats.ts",
      "src/cli/resolvers.ts",
      "src/cli/validation.ts",
    ],
    rules: ["anti-slop/require-safety-comment-for-type-assertion"],
  },
  {
    phase: 6,
    files: ["src/cli/commands/match.ts", "src/cli/team-filters.ts"],
    rules: ["anti-slop/no-unsafe-dictionary-type"],
  },
  {
    phase: 6,
    files: ["src/cli/completeness-output.ts"],
    rules: ["anti-slop/no-object-parameters"],
  },
  {
    phase: 6,
    files: ["src/cli/formatters/csv.ts"],
    rules: [
      "anti-slop/no-known-value-widening",
      "anti-slop/no-runtime-typeof",
      "anti-slop/no-unknown-parameters",
      "anti-slop/no-unsafe-dictionary-type",
      "anti-slop/require-safety-comment-for-type-assertion",
      "typescript/no-base-to-string",
    ],
  },
  {
    phase: 6,
    files: ["src/cli/formatters/json.ts"],
    rules: [
      "anti-slop/no-known-value-widening",
      "anti-slop/no-runtime-typeof",
      "anti-slop/no-unknown-parameters",
      "anti-slop/no-unknown-returns",
      "anti-slop/no-unsafe-dictionary-type",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 6,
    files: ["src/cli/formatters/table.ts"],
    rules: [
      "anti-slop/no-runtime-typeof",
      "anti-slop/no-unknown-parameters",
      "anti-slop/no-unknown-returns",
      "anti-slop/no-unsafe-dictionary-type",
      "anti-slop/require-safety-comment-for-type-assertion",
      "typescript/no-base-to-string",
    ],
  },
  {
    phase: 7,
    files: ["scripts/canary-baseline.ts"],
    rules: ["anti-slop/no-runtime-typeof", "anti-slop/no-unknown-parameters"],
  },
  {
    phase: 7,
    files: [
      "scripts/canary.ts",
      "test/cli/completeness-output.test.ts",
      "test/cli/ladder-envelope.test.ts",
      "test/cli/stats-filters.test.ts",
      "test/cli/team-response.test.ts",
      "test/golden/cli-preload.ts",
      "test/lib/result.test.ts",
      "test/transforms/match-results.test.ts",
      "test/transforms/player-stats-query.test.ts",
    ],
    rules: ["anti-slop/require-safety-comment-for-type-assertion"],
  },
  {
    phase: 7,
    files: ["test/api/ladder.test.ts", "test/api/player-details.test.ts", "test/api/squad.test.ts"],
    rules: [
      "anti-slop/no-chained-type-assertions",
      "anti-slop/no-runtime-typeof",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 7,
    files: ["test/api/lineup.test.ts", "test/api/teams.test.ts"],
    rules: [
      "anti-slop/no-chained-type-assertions",
      "anti-slop/no-runtime-typeof",
      "anti-slop/require-safety-comment-for-type-assertion",
      "typescript/no-base-to-string",
    ],
  },
  {
    phase: 7,
    files: [
      "test/api/match-coaches.test.ts",
      "test/sources/adapters/footywire.test.ts",
      "test/sources/afl-tables.test.ts",
      "test/sources/footywire.test.ts",
    ],
    rules: ["typescript/no-base-to-string"],
  },
  {
    phase: 7,
    files: ["test/api/team-stats.test.ts"],
    rules: [
      "anti-slop/no-chained-type-assertions",
      "anti-slop/no-runtime-typeof",
      "anti-slop/require-safety-comment-for-type-assertion",
      "typescript/unbound-method",
    ],
  },
  {
    phase: 7,
    files: ["test/cli/resolvers.test.ts"],
    rules: [
      "anti-slop/no-unknown-parameters",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 7,
    files: ["test/golden/fixture-fetch.ts", "test/transforms/player-canonical.test.ts"],
    rules: ["anti-slop/no-runtime-typeof"],
  },
  {
    phase: 7,
    files: ["test/golden/public-api.test.ts"],
    rules: [
      "anti-slop/no-known-value-widening",
      "anti-slop/no-runtime-typeof",
      "anti-slop/no-unknown-parameters",
      "anti-slop/no-unknown-returns",
      "anti-slop/no-unsafe-dictionary-type",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 7,
    files: [
      "test/lib/fetch-retry.test.ts",
      "test/lib/fetch-timeout.test.ts",
      "test/sources/adapters/afl-tables-ladder.test.ts",
      "test/sources/adapters/squad-scope.test.ts",
      "test/sources/adapters/squiggle.test.ts",
    ],
    rules: [
      "anti-slop/no-chained-type-assertions",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 7,
    files: ["test/sources/afl-api.test.ts"],
    rules: [
      "anti-slop/no-known-value-widening",
      "anti-slop/no-runtime-typeof",
      "anti-slop/no-unknown-parameters",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 7,
    files: ["test/sources/afl-coaches.test.ts"],
    rules: [
      "anti-slop-effect/prefer-effect-match",
      "anti-slop/no-chained-type-assertions",
      "anti-slop/require-safety-comment-for-type-assertion",
      "typescript/no-base-to-string",
    ],
  },
  {
    phase: 7,
    files: ["test/sources/squiggle.test.ts"],
    rules: [
      "anti-slop/no-known-value-widening",
      "anti-slop/require-safety-comment-for-type-assertion",
      "typescript/no-base-to-string",
    ],
  },
  {
    phase: 7,
    files: ["test/transforms/lineup.test.ts"],
    rules: [
      "anti-slop/no-unsafe-dictionary-type",
      "anti-slop/require-safety-comment-for-type-assertion",
    ],
  },
  {
    phase: 7,
    files: ["test/transforms/player-stats.test.ts"],
    rules: ["anti-slop/no-unsafe-dictionary-type"],
  },
  {
    phase: 7,
    files: ["test/transforms/squiggle.test.ts"],
    rules: ["anti-slop/no-unknown-returns"],
  },
];

/**
 * `src/sources/adapters/index.ts` registers every source adapter as an import
 * side effect, which `sideEffects: false` would let the bundler drop. Phase 4
 * of the v7 migration replaces this registration with a layer.
 */
const treeshake = {
  moduleSideEffects: (id: string) => id.endsWith("/src/sources/adapters/index.ts"),
};

export default defineConfig({
  fmt: {
    // rumdl and Vale own Markdown and the Vale styles; Oxfmt formats code only.
    ignorePatterns: [...IGNORED, "**/*.md", "styles/**"],
    printWidth: 100,
  },
  lint: {
    // `scripts/probe-*.ts` are one-off source investigations kept for reference.
    // They run with Bun, sit outside the type-checked project, and are not linted.
    ignorePatterns: [...IGNORED, "scripts/probe-*.ts"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    // Vendored from dmmulroy/anti-slop at c44ef22 (2026-09-10). Imports use
    // `vite-plus/lint/plugins` so the plugin API matches the bundled Oxlint.
    jsPlugins: [
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      { name: "anti-slop-effect", specifier: "./tools/oxlint/anti-slop/effect/index.ts" },
    ],
    rules: {
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "prefer-const": "error",
      "import/no-default-export": "error",
      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "anti-slop-effect/no-manual-effect-error-tag": "error",
      "anti-slop-effect/no-manual-tag-comparison": "error",
      "anti-slop-effect/no-manual-tagged-construction": "error",
      "anti-slop-effect/no-service-constructor-imports": "error",
      "anti-slop-effect/prefer-effect-match": "error",
    },
    overrides: [
      {
        files: ["*.config.ts"],
        rules: { "import/no-default-export": "off" },
      },
      ...MIGRATION_DEBT.map((debt) => ({
        files: debt.files,
        rules: Object.fromEntries(debt.rules.map((rule) => [rule, "off" as const])),
      })),
    ],
  },
  staged: {
    "*.{ts,mts,js,mjs,json}": "vp check --fix",
  },
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 68,
        functions: 67,
        statements: 65,
        branches: 53,
      },
    },
  },
  pack: [
    {
      entry: ["src/index.ts", "src/schemas.ts"],
      format: "esm",
      platform: "neutral",
      dts: true,
      clean: false,
      treeshake,
      fixedExtension: false,
    },
    {
      entry: ["src/cli.ts"],
      format: "esm",
      platform: "node",
      dts: false,
      clean: false,
      treeshake,
      fixedExtension: false,
      define: { PACKAGE_VERSION: JSON.stringify(pkg.version) },
    },
  ],
});
