import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
let consumerDirectory;
let tarballPath;

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
  }

  return result.stdout;
}

try {
  const packOutput = run("npm", ["pack", "--json", "--ignore-scripts"], repoRoot);
  const packOutputLines = packOutput.split(/\r?\n/);
  const arrayStart = packOutputLines.indexOf("[");
  const objectStart = packOutputLines.indexOf("{");
  const jsonStart =
    arrayStart === -1
      ? objectStart
      : objectStart === -1
        ? arrayStart
        : Math.min(arrayStart, objectStart);
  const closingToken = packOutputLines[jsonStart] === "[" ? "]" : "}";
  const jsonEnd = packOutputLines.lastIndexOf(closingToken);
  if (jsonStart === -1 || jsonEnd < jsonStart) {
    throw new Error("npm pack did not return a JSON payload");
  }

  const parsedPackOutput = JSON.parse(packOutputLines.slice(jsonStart, jsonEnd + 1).join("\n"));
  const packEntries = Array.isArray(parsedPackOutput)
    ? parsedPackOutput
    : Object.values(parsedPackOutput);
  const [{ filename }] = packEntries;
  tarballPath = resolve(repoRoot, filename);

  consumerDirectory = await mkdtemp(join(tmpdir(), "fitzroy-package-consumer-"));
  run("npm", ["install", "--no-package-lock", tarballPath], consumerDirectory);

  const importCheck = [
    'const fitzroy = await import("fitzroy");',
    'if (typeof fitzroy.fetchMatches !== "function") process.exit(1);',
  ].join("\n");
  run(process.execPath, ["--input-type=module", "--eval", importCheck], consumerDirectory);

  const cliPath = join(consumerDirectory, "node_modules", "fitzroy", "dist", "cli.js");
  run(process.execPath, [cliPath, "--help"], consumerDirectory);
} finally {
  if (consumerDirectory) await rm(consumerDirectory, { recursive: true, force: true });
  if (tarballPath) await rm(tarballPath, { force: true });
}
