import { extname } from "node:path";

export const bundlesByPlatform = {
  windows: {
    arch: "x64",
    bundleTargets: "nsis,msi",
    artifacts: [
      { bundle: "nsis", extension: ".exe" },
      { bundle: "msi", extension: ".msi" },
    ],
    host: "win32",
    os: "windows",
  },
  linux: {
    arch: "x64",
    bundleTargets: "appimage,deb",
    artifacts: [
      { bundle: "appimage", extension: ".AppImage" },
      { bundle: "deb", extension: ".deb" },
    ],
    host: "linux",
    os: "linux",
  },
  "macos-intel": {
    arch: "x64",
    bundleTargets: "app,dmg",
    artifacts: [{ bundle: "dmg", extension: ".dmg" }],
    host: "darwin",
    os: "macos",
    target: "x86_64-apple-darwin",
  },
  "macos-apple-silicon": {
    arch: "arm64",
    bundleTargets: "app,dmg",
    artifacts: [{ bundle: "dmg", extension: ".dmg" }],
    host: "darwin",
    os: "macos",
    target: "aarch64-apple-darwin",
  },
};

export function getCurrentPlatform(platform = process.platform, arch = process.arch) {
  if (platform === "win32") {
    return "windows";
  }

  if (platform === "linux") {
    return "linux";
  }

  return arch === "arm64" ? "macos-apple-silicon" : "macos-intel";
}

export function isBundleArtifact(filename, artifact) {
  return extname(filename).toLowerCase() === artifact.extension.toLowerCase();
}

export function getReleaseArtifactName(version, config, artifact) {
  return (
    ["EasyTrim", version, config.os, config.arch, artifact.bundle].join("_") + artifact.extension
  );
}
