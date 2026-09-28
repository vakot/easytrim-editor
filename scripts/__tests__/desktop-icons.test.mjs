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

test("app and desktop icon sources remain available", async () => {
  await Promise.all([
    access(new URL("../../apps/desktop/public/logo-square.svg", import.meta.url)),
    access(new URL("../../apps/desktop/public/logo-symbol.svg", import.meta.url)),
    access(new URL("../../apps/desktop/public/logo-circle.svg", import.meta.url)),
    access(new URL("../../apps/desktop/src-tauri/icons/icon.png", import.meta.url)),
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

test("macOS Icon Composer keeps its square background separate from the symbol", async () => {
  const icon = await readConfig("icon-sources/macos/logo_mac_composer.icon/icon.json");
  const layers = icon.groups[0].layers;
  const assetsRoot = new URL(
    "../../apps/desktop/src-tauri/icon-sources/macos/logo_mac_composer.icon/Assets/",
    import.meta.url,
  );
  const [background, symbol] = await Promise.all([
    readFile(new URL("background.svg", assetsRoot), "utf8"),
    readFile(new URL("logo.svg", assetsRoot), "utf8"),
  ]);

  assert.deepEqual(
    layers.map(({ name, "image-name": imageName }) => [name, imageName]),
    [
      ["background", "background.svg"],
      ["symbol", "logo.svg"],
    ],
  );
  assert.equal("fill" in icon, false);
  assert.equal("shadow" in icon.groups[0], false);
  assert.equal("translucency" in icon.groups[0], false);
  assert.match(background, /<svg[^>]*width="512" height="512" viewBox="0 0 512 512"/);
  assert.equal((background.match(/<rect width="512" height="512"/g) ?? []).length, 3);
  assert.doesNotMatch(background, /<mask\b/);
  assert.match(symbol, /<svg[^>]*viewBox="0 0 372 356"/);
});
