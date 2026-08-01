import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const bundlesByPlatform = {
  windows: { bundles: "nsis,msi", directories: ["nsis", "msi"], host: "win32" },
  linux: { bundles: "appimage,deb", directories: ["appimage", "deb"], host: "linux" },
  "macos-intel": {
    bundles: "app,dmg",
    directories: ["dmg"],
    host: "darwin",
    target: "x86_64-apple-darwin",
  },
  "macos-apple-silicon": {
    bundles: "app,dmg",
    directories: ["dmg"],
    host: "darwin",
    target: "aarch64-apple-darwin",
  },
};

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function fail(message) {
  console.error(`release:local: ${message}`);
  process.exit(1);
}

const tag = readOption("tag");
const requestedPlatform = readOption("platform", "current");
const currentPlatform =
  process.platform === "win32"
    ? "windows"
    : process.platform === "linux"
      ? "linux"
      : process.arch === "arm64"
        ? "macos-apple-silicon"
        : "macos-intel";
const platform = requestedPlatform === "current" ? currentPlatform : requestedPlatform;
const config = bundlesByPlatform[platform];

if (!tag) {
  fail("missing --tag, for example --tag v1.0.1");
}

if (!config) {
  fail(`unsupported platform: ${platform}`);
}

if (config.host !== process.platform) {
  fail(
    `${platform} builds must run on ${config.host}; Windows cannot produce a macOS build, and macOS cannot produce a Windows build`,
  );
}

const tauriArgs = [
  "--filter",
  "@easytrim-editor/desktop",
  "tauri",
  "build",
  "--bundles",
  config.bundles,
];

if (config.target) {
  tauriArgs.push("--target", config.target);
}

console.log(`Building ${platform} artifacts for ${tag}...`);
const build = spawnSync("pnpm", tauriArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const bundleRoot = join(
  "apps",
  "desktop",
  "src-tauri",
  "target",
  ...(config.target ? [config.target] : []),
  "release",
  "bundle",
);
const artifacts = [];
for (const directory of config.directories) {
  const artifactDirectory = join(bundleRoot, directory);
  const entries = await readdir(artifactDirectory, { withFileTypes: true });
  artifacts.push(
    ...entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(artifactDirectory, entry.name)),
  );
}

if (artifacts.length === 0) {
  fail(`no artifacts found in ${relative(process.cwd(), bundleRoot)}`);
}

console.log(`Uploading ${artifacts.length} artifact(s) to GitHub release ${tag}...`);
const upload = spawnSync("gh", ["release", "upload", tag, ...artifacts, "--clobber"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(upload.status ?? 1);
