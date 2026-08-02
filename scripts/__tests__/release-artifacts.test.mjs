import assert from "node:assert/strict";
import test from "node:test";

import {
  bundlesByPlatform,
  getCurrentPlatform,
  getReleaseArtifactName,
  isBundleArtifact,
} from "../release-artifacts.mjs";

test("selects only the distributable DMG from the macOS bundle directory", () => {
  const [dmg] = bundlesByPlatform["macos-apple-silicon"].artifacts;

  assert.equal(isBundleArtifact("EasyTrim Editor_1.0.0_aarch64.dmg", dmg), true);
  assert.equal(isBundleArtifact("EasyTrim Editor.icns", dmg), false);
  assert.equal(isBundleArtifact("bundle_dmg.sh", dmg), false);
});

test("uses stable release names for Linux artifacts", () => {
  const config = bundlesByPlatform.linux;

  assert.deepEqual(
    config.artifacts.map((artifact) => getReleaseArtifactName("1.0.0", config, artifact)),
    ["EasyTrim_1.0.0_linux_x64_appimage.AppImage", "EasyTrim_1.0.0_linux_x64_deb.deb"],
  );
});

test("maps native hosts to supported release platforms", () => {
  assert.equal(getCurrentPlatform("win32", "x64"), "windows");
  assert.equal(getCurrentPlatform("linux", "x64"), "linux");
  assert.equal(getCurrentPlatform("darwin", "arm64"), "macos-apple-silicon");
  assert.equal(getCurrentPlatform("darwin", "x64"), "macos-intel");
});
