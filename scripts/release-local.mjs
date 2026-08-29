import { spawnSync } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

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

function getUpdaterPlatform(platform) {
  return {
    windows: "windows-x86_64",
    linux: "linux-x86_64",
    "macos-intel": "darwin-x86_64",
    "macos-apple-silicon": "darwin-aarch64",
  }[platform];
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

if (!tag) {
  fail("missing --tag, for example --tag v1.0.2");
}

if (!process.env.TAURI_SIGNING_PRIVATE_KEY && !process.env.TAURI_SIGNING_PRIVATE_KEY_PATH) {
  fail("missing TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH");
}

if (!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  fail("missing TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
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
    (entry) =>
      entry.isFile() &&
      isBundleArtifact(entry.name, artifact) &&
      entry.name.includes(`_${tauriConfig.version}_`),
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

      const signature = `${path}.sig`;

      try {
        await access(signature);
      } catch {
        fail(`missing signature for ${relative(process.cwd(), path)}`);
      }

      await copyFile(path, stagedArtifact);
      await copyFile(signature, `${stagedArtifact}.sig`);
      return { artifact, path: stagedArtifact, signature: `${stagedArtifact}.sig` };
    }),
  );

  const updaterArtifact =
    stagedArtifacts.find(({ artifact }) => artifact.bundle === "nsis") ?? stagedArtifacts[0];

  const updaterJsonPath = join(stagingDirectory, "latest.json");
  const updaterJson = {
    version: tauriConfig.version,
    notes: `EasyTrim Editor ${tag}`,
    pub_date: new Date().toISOString(),
    platforms: {
      [getUpdaterPlatform(platform)]: {
        signature: (await readFile(updaterArtifact.signature, "utf8")).trim(),
        url: `https://github.com/vakot/easytrim-editor/releases/download/${tag}/${basename(updaterArtifact.path)}`,
      },
    },
  };

  await writeFile(updaterJsonPath, `${JSON.stringify(updaterJson, null, 2)}\n`, "utf8");

  console.log(
    `Prepared ${stagedArtifacts.length} signed artifact(s) and latest.json in ${stagingDirectory}.`,
  );

  if (shouldUpload) {
    const uploadPaths = [
      ...stagedArtifacts.flatMap(({ path, signature }) => [path, signature]),
      updaterJsonPath,
    ];

    console.log(`Uploading signed artifacts and latest.json to GitHub release ${tag}...`);
    const upload = spawnSync("gh", ["release", "upload", tag, ...uploadPaths, "--clobber"], {
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
