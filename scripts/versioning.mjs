import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const VERSION_INCREMENTS = new Set(["patch", "minor", "major"]);

function parseVersion(version, label) {
  const match = VERSION_PATTERN.exec(version);
  if (!match) {
    throw new Error(`${label} must be a semantic version such as 1.2.3`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function readMatchedVersion(content, pattern, label) {
  const match = pattern.exec(content);
  if (!match) {
    throw new Error(`Could not find ${label}`);
  }

  return match[2];
}

function replaceMatchedVersion(content, pattern, version, label) {
  let replacements = 0;
  const updated = content.replace(pattern, (_match, prefix, _currentVersion, suffix) => {
    replacements += 1;
    return `${prefix}${version}${suffix}`;
  });

  if (replacements !== 1) {
    throw new Error(`Expected exactly one ${label}, found ${replacements}`);
  }

  return updated;
}

const cargoWorkspaceVersionPattern = /(\[workspace\.package\][\s\S]*?\bversion\s*=\s*")([^"]+)(")/;
const cargoLockVersionPattern =
  /(\[\[package\]\]\r?\nname = "easytrim-editor-desktop"\r?\nversion = ")([^"]+)(")/;

const jsonVersionPattern = /("version"\s*:\s*")([^"]+)(")/;

export function resolveVersion(currentVersion, request) {
  const current = parseVersion(currentVersion, "Current version");

  if (!VERSION_INCREMENTS.has(request)) {
    parseVersion(request, "Requested version");
    return request;
  }

  if (request === "major") {
    return `${current.major + 1}.0.0`;
  }

  if (request === "minor") {
    return `${current.major}.${current.minor + 1}.0`;
  }

  return `${current.major}.${current.minor}.${current.patch + 1}`;
}

export function parseVersionRequest(args) {
  if (args.length === 1) {
    const request = args[0].replace(/^--(?=patch$|minor$|major$)/, "");
    if (VERSION_INCREMENTS.has(request) || VERSION_PATTERN.test(request)) {
      return request;
    }
  }

  if (args.length === 2 && args[0] === "--version" && VERSION_PATTERN.test(args[1])) {
    return args[1];
  }

  throw new Error(
    "Usage: pnpm version:bump <patch|minor|major|version> (for example: pnpm version:bump patch or pnpm version:bump 1.2.3)",
  );
}

export async function bumpVersion(request, repositoryRoot = process.cwd()) {
  const paths = {
    packageJson: join(repositoryRoot, "package.json"),
    cargoToml: join(repositoryRoot, "Cargo.toml"),
    cargoLock: join(repositoryRoot, "Cargo.lock"),
    tauriConfig: join(repositoryRoot, "apps", "desktop", "src-tauri", "tauri.conf.json"),
  };

  const [packageContent, cargoToml, cargoLock, tauriContent] = await Promise.all([
    readFile(paths.packageJson, "utf8"),
    readFile(paths.cargoToml, "utf8"),
    readFile(paths.cargoLock, "utf8"),
    readFile(paths.tauriConfig, "utf8"),
  ]);

  const packageJson = JSON.parse(packageContent);
  const tauriConfig = JSON.parse(tauriContent);
  const versions = {
    npm: packageJson.version,
    cargo: readMatchedVersion(cargoToml, cargoWorkspaceVersionPattern, "Cargo workspace version"),
    cargoLock: readMatchedVersion(cargoLock, cargoLockVersionPattern, "Cargo lock package version"),
    tauri: tauriConfig.version,
  };

  const uniqueVersions = new Set(Object.values(versions));

  if (uniqueVersions.size !== 1) {
    throw new Error(
      `Version sources are out of sync: ${Object.entries(versions)
        .map(([source, version]) => `${source}=${version}`)
        .join(", ")}`,
    );
  }

  const currentVersion = versions.npm;
  const nextVersion = resolveVersion(currentVersion, request);
  if (nextVersion === currentVersion) {
    throw new Error(`Version is already ${currentVersion}`);
  }

  const updates = [
    [
      paths.packageJson,
      replaceMatchedVersion(packageContent, jsonVersionPattern, nextVersion, "npm package version"),
    ],
    [
      paths.cargoToml,
      replaceMatchedVersion(
        cargoToml,
        cargoWorkspaceVersionPattern,
        nextVersion,
        "Cargo workspace version",
      ),
    ],
    [
      paths.cargoLock,
      replaceMatchedVersion(
        cargoLock,
        cargoLockVersionPattern,
        nextVersion,
        "Cargo lock package version",
      ),
    ],
    [
      paths.tauriConfig,
      replaceMatchedVersion(tauriContent, jsonVersionPattern, nextVersion, "Tauri version"),
    ],
  ];

  await Promise.all(updates.map(([path, content]) => writeFile(path, content, "utf8")));

  return { currentVersion, nextVersion };
}
