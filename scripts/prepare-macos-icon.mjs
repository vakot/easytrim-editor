import { spawnSync } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
  console.log("Skipping Icon Composer compilation outside macOS.");
  process.exit(0);
}

const iconName = "logo_mac_composer";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(
  repositoryRoot,
  "apps",
  "desktop",
  "src-tauri",
  "icon-sources",
  "macos",
  `${iconName}.icon`,
);

const output = resolve(repositoryRoot, "target", "icon-assets", "macos");
const partialInfoPlist = resolve(output, "partial-info.plist");

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });

const result = spawnSync(
  "xcrun",
  [
    "actool",
    source,
    "--compile",
    output,
    "--output-format",
    "human-readable-text",
    "--notices",
    "--warnings",
    "--errors",
    "--output-partial-info-plist",
    partialInfoPlist,
    "--app-icon",
    iconName,
    "--include-all-app-icons",
    "--enable-on-demand-resources",
    "NO",
    "--development-region",
    "en",
    "--target-device",
    "mac",
    "--minimum-deployment-target",
    "10.13",
    "--platform",
    "macosx",
  ],
  { cwd: repositoryRoot, stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const expectedFiles = ["Assets.car", `${iconName}.icns`];
const generatedFiles = await readdir(output);

for (const filename of expectedFiles) {
  const details = await stat(resolve(output, filename)).catch(() => null);
  if (!details?.isFile() || details.size === 0) {
    throw new Error(
      `Icon Composer did not generate ${filename}. Generated files: ${generatedFiles.join(", ")}`,
    );
  }
}

console.log(`Prepared ${expectedFiles.join(" and ")} for the macOS application bundle.`);
