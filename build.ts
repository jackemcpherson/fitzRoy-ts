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

// Schemas subpath bundle — raw upstream wire schemas (fitzroy/schemas)
await build({
  entryPoints: ["src/schemas.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/schemas.js",
  packages: "external",
  platform: "neutral",
});

// CLI bundle — node platform for process/fs access. The interactive
// CLI-only deps (citty, @clack/prompts, picocolors) are devDependencies
// bundled INTO dist/cli.js so library consumers never install them;
// the library's runtime deps stay external and resolve from node_modules.
await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/cli.js",
  external: Object.keys(pkg.dependencies),
  platform: "node",
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version),
  },
});
