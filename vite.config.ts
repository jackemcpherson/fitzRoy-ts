import { readFileSync } from "node:fs";
import { configDefaults, defineConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

// Resolve next to this config, not the working directory, so `vp` works from subdirectories.
const pkg: { readonly version: string } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);

/** Paths that are not project source: build output, fixtures, archives, agent tooling. */
const IGNORED = [
  ".claude/**",
  ".agents/**",
  ".rumdl_cache/**",
  ".wrangler/**",
  "dist/**",
  "build/**",
  "coverage/**",
  "comparison/**",
  "test/fixtures/**",
  "test/golden/__snapshots__/**",
  "tools/oxlint/anti-slop/**",
];

/**
 * Standalone CLI executable (Node single executable application). Built only
 * when `FITZROY_EXE=1`, because it needs Node 25.7 or later.
 */
const EXE_PACK: PackUserConfig = {
  entry: ["src/cli.ts"],
  format: "esm",
  platform: "node",
  dts: false,
  clean: false,
  exe: true,
  // A single executable has no node_modules, so bundle every dependency.
  deps: { alwaysBundle: [/./], onlyBundle: false },
  define: { PACKAGE_VERSION: JSON.stringify(pkg.version) },
};

const isExeBuild = process.env["FITZROY_EXE"] === "1";

export default defineConfig({
  fmt: {
    // rumdl and Vale own Markdown and the Vale styles; Oxfmt formats code only.
    ignorePatterns: [...IGNORED, "**/*.md", "styles/**"],
    printWidth: 100,
  },
  lint: {
    // `scripts/probe-*.ts` are one-off source investigations kept for reference.
    // They sit outside the type-checked project and are not linted.
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
    ],
  },
  staged: {
    "*.{ts,mts,js,mjs,json}": "vp check --fix",
  },
  test: {
    globals: true,
    environment: "node",
    exclude: [...configDefaults.exclude, "**/dist/**", "**/.claude/**", "comparison/**"],
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
  pack: isExeBuild
    ? [EXE_PACK]
    : [
        {
          entry: ["src/index.ts", "src/schemas.ts"],
          format: "esm",
          platform: "neutral",
          dts: true,
          clean: false,
          fixedExtension: false,
        },
        {
          entry: ["src/cli.ts"],
          format: "esm",
          platform: "node",
          dts: false,
          clean: false,
          fixedExtension: false,
          define: { PACKAGE_VERSION: JSON.stringify(pkg.version) },
        },
      ],
});
