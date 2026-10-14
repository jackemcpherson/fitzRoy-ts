/**
 * Golden characterisation tests for CLI output (v7 migration safety net).
 *
 * Each case runs `src/cli.ts` in a Node.js subprocess with fixture-backed
 * fetch preloaded, and snapshots the exit code, stdout, and stderr. The v7 Effect
 * migration must keep these snapshots unchanged.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const ROOT = resolve(__dirname, "../..");

const PRELOAD = resolve(__dirname, "cli-preload.mjs");

/**
 * The entry point under test. CI sets `FITZROY_CLI_ENTRY=dist/cli.js` after
 * the build so the bundled CLI must produce the same snapshots as the source.
 */
const ENTRY = process.env["FITZROY_CLI_ENTRY"] ?? "src/cli.ts";

/** Keep JSON snapshots reviewable by bounding very long output. */
const MAX_OUTPUT_CHARS = 6000;

function bound(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) return output;

  return `${output.slice(0, MAX_OUTPUT_CHARS)}\n…[${output.length - MAX_OUTPUT_CHARS} more chars]`;
}

function runCli(args: readonly string[]) {
  const result = spawnSync(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", "--import", PRELOAD, ENTRY, ...args],
    {
      cwd: ROOT,
      encoding: "utf-8",
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", TZ: "Australia/Melbourne" },
      timeout: 60_000,
    },
  );

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
