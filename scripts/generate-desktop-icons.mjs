import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repositoryRoot, "apps", "desktop", "public", "logo-symbol.svg");
const iconRoot = resolve(repositoryRoot, "apps", "desktop", "src-tauri", "icons");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "easytrim-desktop-icons-"));
const squareSource = join(temporaryDirectory, "logo-symbol-square.svg");

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
  ["icon.png", join(iconRoot, "icon.png")],
  ["icon.ico", join(iconRoot, "windows", "icon.ico")],
  ["32x32.png", join(iconRoot, "linux", "32x32.png")],
  ["128x128.png", join(iconRoot, "linux", "128x128.png")],
  ["128x128@2x.png", join(iconRoot, "linux", "128x128@2x.png")],
  ["icon.png", join(iconRoot, "linux", "icon.png")],
];

try {
  const symbol = await readFile(source, "utf8");
  const squareSymbol = symbol.replace(
    'width="372" height="356" viewBox="0 0 372 356"',
    'width="372" height="372" viewBox="0 -8 372 372"',
  );

  if (squareSymbol === symbol) {
    throw new Error("The logo symbol SVG canvas dimensions have changed; update the icon padding.");
  }

  await writeFile(squareSource, squareSymbol);
  run("pnpm", [
    "--filter",
    "@easytrim-editor/desktop",
    "tauri",
    "icon",
    squareSource,
    "--output",
    temporaryDirectory,
  ]);

  await Promise.all(
    outputs.map(async ([generatedName, destination]) => {
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(temporaryDirectory, generatedName), destination);
    }),
  );

  console.log(`Prepared ${outputs.length} shared, Windows, and Linux desktop icon assets.`);
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
