import { spawn, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";

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
  console.error(`preview: production executable not found at ${executablePath}`);
  console.error("Run `pnpm build` first.");
  process.exit(1);
}

console.log(`Launching production build: ${executablePath}`);
const { EASYTRIM_MEDIA_DEBUG: _mediaDebug, ...productionEnvironment } = process.env;
const application = spawn(executablePath, process.argv.slice(2), {
  env: productionEnvironment,
  stdio: "inherit",
  windowsHide: false,
});

application.once("error", (error) => {
  console.error(`preview: failed to launch production executable: ${error.message}`);
  process.exit(1);
});
application.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
