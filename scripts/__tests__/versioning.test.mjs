import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { bumpVersion, parseVersionRequest, resolveVersion } from "../versioning.mjs";

test("resolves patch, minor, major, and explicit versions", () => {
  assert.equal(resolveVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(resolveVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(resolveVersion("1.2.3", "major"), "2.0.0");
  assert.equal(resolveVersion("1.2.3", "2.5.0"), "2.5.0");
});

test("accepts positional and option version requests", () => {
  assert.equal(parseVersionRequest(["patch"]), "patch");
  assert.equal(parseVersionRequest(["--minor"]), "minor");
  assert.equal(parseVersionRequest(["2.0.0"]), "2.0.0");
  assert.equal(parseVersionRequest(["--version", "2.0.0-beta.1"]), "2.0.0-beta.1");
});

test("rejects invalid version requests", () => {
  assert.throws(() => parseVersionRequest([]), /Usage:/);
  assert.throws(() => parseVersionRequest(["latest"]), /Usage:/);
  assert.throws(() => resolveVersion("1.2.3", "1.2"), /semantic version/);
});

test("updates every application version source", async () => {
  const repositoryRoot = await createVersionFixture();

  try {
    const result = await bumpVersion("minor", repositoryRoot);

    assert.deepEqual(result, { currentVersion: "1.2.3", nextVersion: "1.3.0" });
    assert.equal(
      JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8")).version,
      "1.3.0",
    );
    assert.match(await readFile(join(repositoryRoot, "Cargo.toml"), "utf8"), /version = "1\.3\.0"/);
    assert.match(await readFile(join(repositoryRoot, "Cargo.lock"), "utf8"), /version = "1\.3\.0"/);
    assert.equal(
      JSON.parse(
        await readFile(
          join(repositoryRoot, "apps", "desktop", "src-tauri", "tauri.conf.json"),
          "utf8",
        ),
      ).version,
      "1.3.0",
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test("refuses to update version sources that are already out of sync", async () => {
  const repositoryRoot = await createVersionFixture({ tauriVersion: "1.2.4" });

  try {
    await assert.rejects(
      () => bumpVersion("patch", repositoryRoot),
      /Version sources are out of sync/,
    );
    assert.equal(
      JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8")).version,
      "1.2.3",
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

async function createVersionFixture({ tauriVersion = "1.2.3" } = {}) {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "easytrim-versioning-"));
  const tauriDirectory = join(repositoryRoot, "apps", "desktop", "src-tauri");
  await mkdir(tauriDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(repositoryRoot, "package.json"), '{"name":"fixture","version":"1.2.3"}\n'),
    writeFile(join(repositoryRoot, "Cargo.toml"), '[workspace.package]\nversion = "1.2.3"\n'),
    writeFile(
      join(repositoryRoot, "Cargo.lock"),
      '[[package]]\nname = "easytrim-editor-desktop"\nversion = "1.2.3"\n',
    ),
    writeFile(
      join(tauriDirectory, "tauri.conf.json"),
      `${JSON.stringify({ productName: "EasyTrim Editor", version: tauriVersion })}\n`,
    ),
  ]);
  return repositoryRoot;
}
