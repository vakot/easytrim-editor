import { mkdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { bundlesByPlatform, getReleaseArtifactName } from "./release-artifacts.mjs";

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function fail(message) {
  console.error(`release:linux: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const tag = readOption("tag");
const outputDirectory = resolve(readOption("output", join("artifacts", "linux")));
const shouldUpload = !hasFlag("no-upload");

if (shouldUpload && !tag) {
  fail("missing --tag; use --no-upload to build without publishing");
}

const docker = spawnSync("docker", ["info"], {
  stdio: "ignore",
  shell: process.platform === "win32",
});

if (docker.status !== 0) {
  fail("Docker is unavailable; start Docker Desktop or the Docker daemon and try again");
}

await mkdir(outputDirectory, { recursive: true });

console.log(`Building Linux release artifacts into ${outputDirectory}...`);
run("docker", [
  "buildx",
  "build",
  "--file",
  "docker/linux-release.Dockerfile",
  "--target",
  "artifacts",
  "--platform",
  "linux/amd64",
  "--output",
  `type=local,dest=${outputDirectory}`,
  ".",
]);

const tauriConfig = JSON.parse(
  await readFile(join("apps", "desktop", "src-tauri", "tauri.conf.json"), "utf8"),
);
const config = bundlesByPlatform.linux;
const artifacts = config.artifacts.map((artifact) =>
  join(outputDirectory, getReleaseArtifactName(tauriConfig.version, config, artifact)),
);

for (const artifact of artifacts) {
  const details = await stat(artifact).catch(() => null);
  if (!details?.isFile() || details.size === 0) {
    fail(`expected Docker output was not created: ${artifact}`);
  }
}

console.log(`Prepared ${artifacts.length} Linux artifact(s).`);

if (shouldUpload) {
  console.log(`Uploading Linux artifacts to GitHub release ${tag}...`);
  run("gh", ["release", "upload", tag, ...artifacts, "--clobber"]);
}
