import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
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
