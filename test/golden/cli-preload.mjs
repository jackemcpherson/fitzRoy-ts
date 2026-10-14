/**
 * Preload for the CLI golden test: run the TypeScript sources on Node,
 * define the build-time version, and serve every request from fixtures.
 */
import "../../scripts/ts-resolve.mjs";

globalThis.PACKAGE_VERSION = "0.0.0-golden";

const { goldenFetch } = await import("./fixture-fetch.ts");

globalThis.fetch = goldenFetch;
