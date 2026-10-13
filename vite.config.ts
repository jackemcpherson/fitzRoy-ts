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

/**
 * Files that still break an anti-slop rule. Each later v7 migration phase
 * removes its entries; the list must be empty before v7.0.0 ships.
 */
const MIGRATION_DEBT: ReadonlyArray<{ readonly files: string[]; readonly rules: string[] }> = [];

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
