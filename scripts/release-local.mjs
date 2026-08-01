import { copyFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const bundlesByPlatform = {
  windows: {
    arch: process.arch,
    bundles: "nsis,msi",
    directories: ["nsis", "msi"],
    host: "win32",
    os: "windows",
  },
  linux: {
    arch: process.arch,
    bundles: "appimage,deb",
    directories: ["appimage", "deb"],
    host: "linux",
    os: "linux",
  },
  "macos-intel": {
    arch: "x64",
    bundles: "app,dmg",
    directories: ["dmg"],
    host: "darwin",
    os: "macos",
    target: "x86_64-apple-darwin",
  },
  "macos-apple-silicon": {
    arch: "arm64",
    bundles: "app,dmg",
    directories: ["dmg"],
    host: "darwin",
    os: "macos",
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
const tauriConfig = JSON.parse(
  await readFile(join("apps", "desktop", "src-tauri", "tauri.conf.json"), "utf8"),
);

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
  process.env.CARGO_TARGET_DIR ?? "target",
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

const stagingDirectory = await mkdtemp(join(tmpdir(), "easytrim-release-"));

try {
  const stagedArtifacts = await Promise.all(
    artifacts.map(async (artifact) => {
      const bundle = relative(bundleRoot, artifact).split(/[\\/]/)[0];
      const filename = ["EasyTrim", tauriConfig.version, config.os, config.arch, bundle].join("_");
      const stagedArtifact = join(stagingDirectory, `${filename}${extname(artifact)}`);
      await copyFile(artifact, stagedArtifact);
      return stagedArtifact;
    }),
  );

  console.log(`Uploading ${stagedArtifacts.length} artifact(s) to GitHub release ${tag}...`);
  const upload = spawnSync("gh", ["release", "upload", tag, ...stagedArtifacts, "--clobber"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  process.exitCode = upload.status ?? 1;
} finally {
  await rm(stagingDirectory, { force: true, recursive: true });
}
