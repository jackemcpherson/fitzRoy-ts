import { build } from "esbuild";
import pkg from "./package.json";

// Library bundle — external deps, consumers install them via npm
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/index.js",
  packages: "external",
  platform: "neutral",
});

// CLI bundle — external deps, node platform for process/fs access
await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/cli.js",
  packages: "external",
  platform: "node",
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version),
  },
});
