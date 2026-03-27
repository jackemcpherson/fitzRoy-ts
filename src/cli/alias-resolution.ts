/**
 * Manual short-flag alias resolution for citty.
 *
 * citty v0.2.1 accepts `alias` in its type definitions but does not
 * resolve short flags at runtime. This module rewrites `process.argv`
 * in-place before citty parses it, mapping `-s` → `--season`, etc.
 */

const SHORT_TO_LONG: Readonly<Record<string, string>> = {
  "-s": "--season",
  "-r": "--round",
  "-c": "--competition",
  "-j": "--json",
  "-t": "--team",
  "-p": "--player",
};

/** Rewrite short flags in `process.argv` to their long equivalents. */
export function resolveAliases(): void {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg != null) {
      const long = SHORT_TO_LONG[arg];
      if (long) {
        process.argv[i] = long;
      }
    }
  }
}
