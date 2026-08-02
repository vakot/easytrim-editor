import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  bundlesByPlatform,
  getCurrentPlatform,
  getReleaseArtifactName,
  isBundleArtifact,
} from "./release-artifacts.mjs";

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function fail(message) {
  console.error(`release:local: ${message}`);
  process.exit(1);
}

const tag = readOption("tag");
const requestedPlatform = readOption("platform", "current");
const outputDirectory = readOption("output");
const shouldUpload = !hasFlag("no-upload");
const currentPlatform = getCurrentPlatform();
const platform = requestedPlatform === "current" ? currentPlatform : requestedPlatform;
const config = bundlesByPlatform[platform];
const tauriConfig = JSON.parse(
  await readFile(join("apps", "desktop", "src-tauri", "tauri.conf.json"), "utf8"),
);

if (shouldUpload && !tag) {
  fail("missing --tag, for example --tag v1.0.1");
}

if (!shouldUpload && !outputDirectory) {
  fail("--no-upload requires --output so the generated artifacts are preserved");
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
  config.bundleTargets,
];

if (config.target) {
  tauriArgs.push("--target", config.target);
}

console.log(`Building ${platform} artifacts${tag ? ` for ${tag}` : ""}...`);
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
for (const artifact of config.artifacts) {
  const artifactDirectory = join(bundleRoot, artifact.bundle);
  const entries = await readdir(artifactDirectory, { withFileTypes: true });
  const matches = entries.filter(
    (entry) => entry.isFile() && isBundleArtifact(entry.name, artifact),
  );

  if (matches.length !== 1) {
    fail(
      `expected exactly one ${artifact.extension} artifact in ${relative(process.cwd(), artifactDirectory)}, found ${matches.length}`,
    );
  }

  artifacts.push({ artifact, path: join(artifactDirectory, matches[0].name) });
}

if (artifacts.length === 0) {
  fail(`no artifacts found in ${relative(process.cwd(), bundleRoot)}`);
}

const stagingDirectory = outputDirectory
  ? resolve(outputDirectory)
  : await mkdtemp(join(tmpdir(), "easytrim-release-"));
const removeStagingDirectory = !outputDirectory;

await mkdir(stagingDirectory, { recursive: true });

try {
  const stagedArtifacts = await Promise.all(
    artifacts.map(async ({ artifact, path }) => {
      const stagedArtifact = join(
        stagingDirectory,
        getReleaseArtifactName(tauriConfig.version, config, artifact),
      );
      await copyFile(path, stagedArtifact);
      return stagedArtifact;
    }),
  );

  console.log(`Prepared ${stagedArtifacts.length} artifact(s) in ${stagingDirectory}.`);

  if (shouldUpload) {
    console.log(`Uploading ${stagedArtifacts.length} artifact(s) to GitHub release ${tag}...`);
    const upload = spawnSync("gh", ["release", "upload", tag, ...stagedArtifacts, "--clobber"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    process.exitCode = upload.status ?? 1;
  }
} finally {
  if (removeStagingDirectory) {
    await rm(stagingDirectory, { force: true, recursive: true });
  }
}
