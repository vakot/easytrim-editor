import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const tauriRoot = new URL("../../apps/desktop/src-tauri/", import.meta.url);

async function readConfig(filename) {
  return JSON.parse(await readFile(new URL(filename, tauriRoot), "utf8"));
}

test("desktop platforms use isolated native icon formats", async () => {
  const [windows, linux, macos] = await Promise.all([
    readConfig("tauri.windows.conf.json"),
    readConfig("tauri.linux.conf.json"),
    readConfig("tauri.macos.conf.json"),
  ]);

  assert.deepEqual(windows.bundle.icon, ["icons/windows/icon.ico"]);
  assert.ok(linux.bundle.icon.every((icon) => icon.endsWith(".png")));
  assert.deepEqual(macos.bundle.icon, ["../../../target/icon-assets/macos/logo_mac_composer.icns"]);
  assert.equal(
    macos.bundle.macOS.files["Resources/Assets.car"],
    "../../../target/icon-assets/macos/Assets.car",
  );
  assert.equal(macos.bundle.macOS.infoPlist, "Info.macos.plist");
});

test("web and Apple icon sources remain available", async () => {
  await Promise.all([
    access(new URL("../../apps/desktop/public/logo-symbol.svg", import.meta.url)),
    access(new URL("../../apps/desktop/src-tauri/icons/windows/icon.ico", import.meta.url)),
    access(new URL("../../apps/desktop/src-tauri/icons/linux/icon.png", import.meta.url)),
    access(
      new URL(
        "../../apps/desktop/src-tauri/icon-sources/macos/logo_mac_composer.icon/icon.json",
        import.meta.url,
      ),
    ),
  ]);
});
