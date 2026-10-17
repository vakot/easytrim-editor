import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  cleanDevelopmentProfiles,
  developmentIdentifier,
  developmentProfileDirectories,
  parseDevArguments,
} from "../dev-profile.mjs";

test("normal development persists; fresh accepts pnpm's optional separator", () => {
  assert.deepEqual(parseDevArguments([]), { fresh: false });
  assert.deepEqual(parseDevArguments(["--"]), { fresh: false });
  assert.deepEqual(parseDevArguments(["--fresh"]), { fresh: true });
  assert.deepEqual(parseDevArguments(["--", "--fresh"]), { fresh: true });
  for (const args of [["--config", "production.json"], ["--fresh", "--fresh"], ["unknown"]]) {
    assert.throws(() => parseDevArguments(args), /Usage/);
  }
});

test("profile locations match Tauri data roots and reject missing/relative roots", () => {
  const home = join(tmpdir(), "home");
  const roaming = join(home, "roaming");
  const local = join(home, "local");
  assert.deepEqual(
    developmentProfileDirectories("win32", { APPDATA: roaming, LOCALAPPDATA: local }),
    [join(roaming, developmentIdentifier), join(local, developmentIdentifier)],
  );
  assert.deepEqual(developmentProfileDirectories("linux", {}, home), [
    join(home, ".local", "share", developmentIdentifier),
  ]);
  assert.deepEqual(developmentProfileDirectories("linux", { XDG_DATA_HOME: local }, home), [
    join(local, developmentIdentifier),
  ]);
  assert.deepEqual(developmentProfileDirectories("darwin", {}, home), [
    join(home, "Library", "Application Support", developmentIdentifier),
  ]);
  assert.throws(() => developmentProfileDirectories("win32", {}), /absolute/);
  assert.throws(
    () => developmentProfileDirectories("linux", { XDG_DATA_HOME: "relative" }),
    /absolute/,
  );
  assert.throws(() => developmentProfileDirectories("other", {}), /unsupported/);
});

test("fresh clears development progress and leaves production untouched; missing profiles are safe", async () => {
  const root = await mkdtemp(join(tmpdir(), "easytrim-dev-test-"));
  const dev = join(root, developmentIdentifier);
  const production = join(root, "com.vakot.easytrimeditor");
  await mkdir(join(dev, "achievements"), { recursive: true });
  await mkdir(production);
  await writeFile(join(dev, "achievements", "achievements.json"), "unlocks and discoveries");
  await writeFile(join(dev, "usage-statistics.json"), "milestone progress");
  await writeFile(join(production, "sentinel"), "production");
  await cleanDevelopmentProfiles([dev]);
  await assert.rejects(readFile(join(dev, "usage-statistics.json")), { code: "ENOENT" });
  await assert.rejects(readFile(join(dev, "achievements", "achievements.json")), {
    code: "ENOENT",
  });
  assert.equal(await readFile(join(production, "sentinel"), "utf8"), "production");
  await cleanDevelopmentProfiles([dev]);
});

test("all targets are checked before deletion, including production paths and junction ancestors", async () => {
  const root = await mkdtemp(join(tmpdir(), "easytrim-dev-safety-"));
  const dev = join(root, developmentIdentifier);
  await mkdir(dev);
  await writeFile(join(dev, "sentinel"), "keep");
  for (const invalid of [root, join(root, "com.vakot.easytrimeditor"), "relative"]) {
    await assert.rejects(cleanDevelopmentProfiles([dev, invalid]), /unsafe/);
    assert.equal(await readFile(join(dev, "sentinel"), "utf8"), "keep");
  }
  const linkedRoot = join(root, "linked");
  await symlink(root, linkedRoot, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(
    cleanDevelopmentProfiles([join(linkedRoot, developmentIdentifier)]),
    /linked/,
  );
  const target = join(root, "target");
  await mkdir(target);
  const linkedProfile = join(target, developmentIdentifier);
  await symlink(dev, linkedProfile, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(cleanDevelopmentProfiles([linkedProfile]), /linked/);
  assert.equal(await readFile(join(dev, "sentinel"), "utf8"), "keep");
});

test("development config isolates the identifier without changing production", async () => {
  const config = async (name) =>
    JSON.parse(
      await readFile(new URL(`../../apps/desktop/src-tauri/${name}`, import.meta.url), "utf8"),
    );

  assert.equal((await config("tauri.dev.conf.json")).identifier, developmentIdentifier);
  assert.equal((await config("tauri.conf.json")).identifier, "com.vakot.easytrimeditor");
});
