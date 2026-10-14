/**
 * Golden characterisation tests for CLI output (v7 migration safety net).
 *
 * Each case runs `src/cli.ts` in a Bun subprocess with fixture-backed fetch
 * preloaded, and snapshots the exit code, stdout, and stderr. Long output is
 * truncated for review, with a SHA-256 of the full text so any change fails. The v7 Effect
 * migration must keep these snapshots unchanged.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const ROOT = resolve(import.meta.dirname, "../..");

const PRELOAD = resolve(import.meta.dirname, "cli-preload.ts");

/**
 * The entry point under test. CI sets `FITZROY_CLI_ENTRY=dist/cli.js` after
 * the build so the bundled CLI must produce the same snapshots as the source.
 */
const ENTRY = process.env["FITZROY_CLI_ENTRY"] ?? "src/cli.ts";

/** Keep JSON snapshots reviewable by bounding very long output. */
const MAX_OUTPUT_CHARS = 6000;

function bound(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) return output;
  const sha256 = createHash("sha256").update(output).digest("hex");

  return `${output.slice(0, MAX_OUTPUT_CHARS)}\n…[${output.length - MAX_OUTPUT_CHARS} more chars, sha256 ${sha256}]`;
}

function runCli(args: readonly string[]) {
  const result = spawnSync(
    "bun",
    [
      "--preload",
      PRELOAD,
      "--define",
      `PACKAGE_VERSION=${JSON.stringify("0.0.0-golden")}`,
      ENTRY,
      ...args,
    ],
    {
      cwd: ROOT,
      encoding: "utf-8",
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", TZ: "Australia/Melbourne" },
      timeout: 60_000,
    },
  );

  // A launch failure or timeout must fail loudly, not snapshot empty output.
  if (result.error) throw result.error;

  if (result.signal !== null) throw new Error(`CLI killed by ${result.signal}`);

  return {
    status: result.status,
    stdout: bound(result.stdout),
    stderr: bound(result.stderr),
  };
}

const CASES: ReadonlyArray<readonly string[]> = [
  ["match", "--season", "2024", "--round", "1", "--json"],
  ["match", "--season", "2024", "--round", "1", "--csv"],
  ["match", "--season", "2024", "--source", "squiggle", "--round", "1", "--json"],
  ["match", "--season", "2019", "--competition", "VFL", "--json"],
  ["match", "--season", "2024", "--source", "fryzigg", "--json"],
  ["stats", "--season", "2024", "--round", "1", "--source", "footywire", "--csv"],
  ["stats", "--season", "2024", "--by", "team", "--source", "footywire", "--json"],
  ["stats", "--season", "2024", "--by", "team", "--source", "afl-tables", "--csv"],
  ["ladder", "--season", "2024", "--round", "10", "--json"],
  ["ladder", "--season", "2024", "--round", "10", "--source", "squiggle", "--csv"],
  ["team", "--json"],
  ["team", "--season", "2024", "--name", "Carlton", "--json"],
  ["player", "--season", "2024", "--team", "Carlton", "--json"],
  ["awards", "--type", "coaches", "--season", "2024", "--round", "1", "--json"],
  ["awards", "--type", "brownlow", "--season", "2024", "--json"],
  ["seasons", "--competition", "AFLW", "--json"],
  ["match", "--season", "not-a-year", "--json"],
  ["match", "--season", "2024", "--unknown-flag", "--json"],
];

describe("CLI golden outcomes", () => {
  for (const args of CASES) {
    it(`keeps the output of fitzroy ${args.join(" ")}`, () => {
      expect(runCli(args)).toMatchSnapshot();
    });
  }
});
