import { defineConfig } from "bunup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: "esm",
  dts: {
    entry: "src/index.ts",
  },
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version),
  },
});
