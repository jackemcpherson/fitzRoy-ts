import { type DefineConfigItem, defineConfig } from "bunup";
import pkg from "./package.json";

const config: DefineConfigItem = {
  entry: ["src/index.ts", "src/cli.ts"],
  format: "esm",
  dts: {
    entry: "src/index.ts",
    inferTypes: true,
  },
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version),
  },
};

export default defineConfig(config);
