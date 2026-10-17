import { spawn, spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import { previewIdentifier, repositoryEnvironment } from "./repository-profile.mjs";

try {
  const config = JSON.parse(
    await readFile(
      new URL("../apps/desktop/src-tauri/tauri.preview.conf.json", import.meta.url),
      "utf8",
    ),
  );

  if (config.identifier !== previewIdentifier) {
    throw new Error("Preview Tauri configuration must use the preview identifier");
  }
} catch (error) {
  console.error(`preview: ${error.message}`);
  process.exit(1);
}

// Rebuild with an explicit preview identity rather than trusting an old production executable.
// No bundles/installers are created, and release packaging continues to use the base config.
const previewEnvironment = repositoryEnvironment(process.env, "preview");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const build = spawnSync(
  command,
  [
    "--filter",
    "@easytrim-editor/desktop",
    "tauri",
    "build",
    "--no-bundle",
    "--config",
    "src-tauri/tauri.preview.conf.json",
  ],
  {
    env: previewEnvironment,
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
  },
);

if (build.error) {
  console.error(`preview: failed to build isolated preview: ${build.error.message}`);
  process.exit(1);
}
if (build.status !== 0) process.exit(build.status ?? 1);

const metadataResult = spawnSync("cargo", ["metadata", "--no-deps", "--format-version", "1"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (metadataResult.status !== 0) {
  process.stderr.write(metadataResult.stderr ?? "Unable to read Cargo workspace metadata.\n");
  process.exit(metadataResult.status ?? 1);
}

const metadata = JSON.parse(metadataResult.stdout);
const desktopPackage = metadata.packages.find(
  (candidate) => candidate.name === "easytrim-editor-desktop",
);

const binaryTarget = desktopPackage?.targets.find((target) => target.kind.includes("bin"));

if (!binaryTarget) {
  console.error("preview: unable to resolve the EasyTrim desktop binary from Cargo metadata");
  process.exit(1);
}

const executableName =
  process.platform === "win32" ? `${binaryTarget.name}.exe` : binaryTarget.name;

const executablePath = join(metadata.target_directory, "release", executableName);

try {
  await access(executablePath);
} catch {
  console.error(`preview: isolated preview executable not found at ${executablePath}`);
  process.exit(1);
}

console.log(`Launching isolated preview build: ${executablePath}`);
const application = spawn(executablePath, process.argv.slice(2), {
  env: previewEnvironment,
  stdio: "inherit",
  windowsHide: false,
});

application.once("error", (error) => {
  console.error(`preview: failed to launch preview executable: ${error.message}`);
  process.exit(1);
});
application.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
