import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const candidate = JSON.parse(await readFile("package.json", "utf8"));
const response = await fetch(
  `https://registry.npmjs.org/${encodeURIComponent(candidate.name)}/${candidate.version}`,
);
let published = false;
if (response.status !== 404) {
  if (!response.ok) throw new Error(`Registry check failed: ${response.status}`);
  const metadata = await response.json();
  assert.equal(metadata.version, candidate.version);
  assert.ok(metadata.dist.attestations, "Published release lacks provenance");
  const directory = await mkdtemp(join(tmpdir(), "fitzroy-registry-check-"));
  try {
    execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", directory], {
      stdio: "pipe",
    });
    const [localTarball] = (await readdir(directory)).filter((name) => name.endsWith(".tgz"));
    assert.ok(localTarball);
    const download = await fetch(metadata.dist.tarball);
    if (!download.ok) throw new Error(`Published tarball fetch failed: ${download.status}`);
    const remoteTarball = join(directory, "published.tgz");
    const bytes = Buffer.from(await download.arrayBuffer());
    const { createHash } = await import("node:crypto");
    const [algorithm, expected] = metadata.dist.integrity.split("-");
    assert.equal(createHash(algorithm).update(bytes).digest("base64"), expected);
    await writeFile(remoteTarball, bytes);
    const trees = [];
    for (const [label, tarball] of [
      ["local", join(directory, localTarball)],
      ["remote", remoteTarball],
    ]) {
      const target = join(directory, label);
      await mkdir(target);
      const names = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).trim().split("\n");
      assert.ok(
        names.every((name) => name.startsWith("package/") && !name.split("/").includes("..")),
      );
      const details = execFileSync("tar", ["-tvzf", tarball], { encoding: "utf8" });
      assert.ok(
        details
          .trim()
          .split("\n")
          .every((line) => line.startsWith("-") || line.startsWith("d")),
      );
      execFileSync("tar", ["-xzf", tarball, "-C", target]);
      const tree = {};
      for (const name of names.filter((name) => !name.endsWith("/"))) {
        const content = await readFile(join(target, name));
        if (name === "package/package.json") {
          const manifest = JSON.parse(content.toString());
          delete manifest.gitHead;
          tree[name] = manifest;
        } else tree[name] = content;
      }
      trees.push(tree);
    }
    assert.deepEqual(trees[0], trees[1], "Published immutable version differs from candidate");
    published = true;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
console.log(
  published ? "Published version matches the candidate" : "Version is available for publication",
);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `published=${published}\n`);
}
