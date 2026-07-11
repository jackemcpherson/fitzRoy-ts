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
  const [{ filename }] = JSON.parse(packOutput);
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
