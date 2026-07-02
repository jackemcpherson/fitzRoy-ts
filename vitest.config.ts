import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Local agent worktrees under .claude/ contain full repo copies; without
    // this exclude vitest discovers every copy's test suite.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts"], // process/TTY entry — exercised manually
      reporter: ["text", "html"],
      thresholds: {
        lines: 68,
        functions: 67,
        statements: 65,
        branches: 53,
      },
    },
  },
});
