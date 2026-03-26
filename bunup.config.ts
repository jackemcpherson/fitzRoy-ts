import { defineConfig } from "bunup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: "esm",
  splitting: false,
  dts: {
    entry: "src/index.ts",
    inferTypes: true,
  },
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version),
  },
});
