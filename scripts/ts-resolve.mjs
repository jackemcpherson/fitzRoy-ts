/**
 * Lets Node.js run the TypeScript sources directly.
 *
 * The sources use bundler-style relative imports without extensions
 * (`./lib/http`), which Node's resolver rejects. This hook retries such a
 * specifier as `<specifier>.ts`, then `<specifier>/index.ts`. Node strips the
 * types itself.
 *
 * Usage: `node --import ./scripts/ts-resolve.mjs <file>.ts`
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const SUFFIXES = [".ts", "/index.ts"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    const hasExtension = /\.[a-z]+$/i.test(specifier);

    if (!isRelative || hasExtension || !context.parentURL?.startsWith("file:")) {
      return nextResolve(specifier, context);
    }

    const suffix = SUFFIXES.find((candidate) =>
      existsSync(new URL(specifier + candidate, context.parentURL)),
    );

    return nextResolve(suffix ? specifier + suffix : specifier, context);
  },
});
