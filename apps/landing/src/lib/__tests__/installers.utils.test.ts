import { describe, expect, it } from "vitest";

import { allPlatformsRelease, releaseAsset, windowsOnlyRelease } from "../../test/github.fixtures";
import { getPlatformInstallers, readInstaller } from "../installers.utils";

describe("readInstaller", () => {
  it("keeps only installers, never signatures, updater bundles, or the update manifest", () => {
    const installers = allPlatformsRelease.assets.flatMap(readInstaller);

    expect(installers.map((installer) => installer.url.split("/").at(-1))).toEqual([
      "EasyTrim_1.15.0_windows_x64_msi.msi",
      "EasyTrim_1.15.0_windows_x64_nsis.exe",
      "EasyTrim_1.15.0_macos_x64_dmg.dmg",
      "EasyTrim_1.15.0_macos_arm64_dmg.dmg",
      "EasyTrim_1.15.0_linux_x64_deb.deb",
      "EasyTrim_1.15.0_linux_x64_appimage.AppImage",
    ]);
  });

  it("describes each installer by platform, architecture, and format", () => {
    expect(readInstaller(releaseAsset("EasyTrim_1.15.0_macos_arm64_dmg.dmg", 10))).toEqual([
      {
        architecture: "arm64",
        extension: ".dmg",
        label: "Apple silicon",
        platform: "macos",
        size: 10,
        url: `https://github.com/vakot/easytrim-editor/releases/download/v1.15.0/EasyTrim_1.15.0_macos_arm64_dmg.dmg`,
      },
    ]);
    expect(readInstaller(releaseAsset("EasyTrim_2.0.0_linux_x64_appimage.appimage", 1))).toEqual([
      expect.objectContaining({ extension: ".AppImage", label: "AppImage", platform: "linux" }),
    ]);
  });

  it("rejects assets hosted anywhere but this repository's releases", () => {
    expect(
      readInstaller({
        browser_download_url: "https://example.com/EasyTrim_1.15.0_windows_x64_nsis.exe",
        name: "EasyTrim_1.15.0_windows_x64_nsis.exe",
        size: 1,
      }),
    ).toEqual([]);
    expect(readInstaller({ name: "EasyTrim.exe" })).toEqual([]);
    expect(readInstaller(null)).toEqual([]);
  });
});

describe("getPlatformInstallers", () => {
  const installers = allPlatformsRelease.assets.flatMap(readInstaller);
  const labels = (...args: Parameters<typeof getPlatformInstallers>) =>
    getPlatformInstallers(...args).map((installer) => installer.label);

  it("puts the preferred format first", () => {
    expect(labels(installers, "windows")).toEqual(["Installer", "MSI package"]);
    expect(labels(installers, "linux")).toEqual(["AppImage", "Debian, Ubuntu"]);
  });

  it("prefers Apple silicon on a Mac unless the browser reports an Intel processor", () => {
    expect(labels(installers, "macos")).toEqual(["Apple silicon", "Intel"]);
    expect(labels(installers, "macos", "arm64")).toEqual(["Apple silicon", "Intel"]);
    expect(labels(installers, "macos", "x64")).toEqual(["Intel", "Apple silicon"]);
  });

  it("returns nothing for a platform the release does not include", () => {
    expect(
      getPlatformInstallers(windowsOnlyRelease.assets.flatMap(readInstaller), "macos"),
    ).toEqual([]);
  });
});
