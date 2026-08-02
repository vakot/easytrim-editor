import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repositoryRoot, "apps", "desktop", "public", "logo-symbol.svg");
const iconRoot = resolve(repositoryRoot, "apps", "desktop", "src-tauri", "icons");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "easytrim-desktop-icons-"));

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const outputs = [
  ["icon.ico", join(iconRoot, "windows", "icon.ico")],
  ["32x32.png", join(iconRoot, "linux", "32x32.png")],
  ["128x128.png", join(iconRoot, "linux", "128x128.png")],
  ["128x128@2x.png", join(iconRoot, "linux", "128x128@2x.png")],
  ["icon.png", join(iconRoot, "linux", "icon.png")],
];

try {
  run("pnpm", [
    "--filter",
    "@easytrim-editor/desktop",
    "tauri",
    "icon",
    source,
    "--output",
    temporaryDirectory,
  ]);

  await Promise.all(
    outputs.map(async ([generatedName, destination]) => {
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(temporaryDirectory, generatedName), destination);
    }),
  );

  console.log(`Prepared ${outputs.length} Windows and Linux desktop icon assets.`);
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
