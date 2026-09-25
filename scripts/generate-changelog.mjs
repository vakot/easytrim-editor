import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = path.join(repositoryRoot, "CHANGELOG.md");
const outputPath = path.join(repositoryRoot, "apps", "desktop", "src", "generated", "changelog.ts");

const CATEGORY_NAMES = ["Added", "Changed", "Fixed", "Deprecated", "Removed", "Security"];
const RELEASE_HEADING_PATTERN = /^## \[([^\]]+)\]$/;
const CATEGORY_HEADING_PATTERN = /^### (.+)$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseVersion(version) {
  const match = VERSION_PATTERN.exec(version);
  if (!match) {
    throw new Error(`Released changelog version must be semantic major.minor.patch: ${version}`);
  }

  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }

  return 0;
}

function parseChangelog(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  if (lines[0]?.trim() !== "# Changelog") {
    throw new Error("CHANGELOG.md must start with # Changelog");
  }

  const releases = [];
  let currentRelease = null;
  let currentSection = null;

  for (const [lineNumber, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (lineNumber === 0 && line === "# Changelog") continue;
    if (line === "" || (lineNumber === 1 && line === "")) continue;

    const releaseMatch = RELEASE_HEADING_PATTERN.exec(line);
    if (releaseMatch) {
      const version = releaseMatch[1];
      const isUnreleased = version.toLowerCase() === "unreleased";
      if (!isUnreleased) parseVersion(version);
      if (releases.some((release) => release.version === version)) {
        throw new Error(
          `Duplicate released changelog version at line ${lineNumber + 1}: ${version}`,
        );
      }

      currentRelease = { version, isUnreleased, sections: [] };
      if (!isUnreleased) releases.push(currentRelease);
      currentSection = null;
      continue;
    }

    const categoryMatch = CATEGORY_HEADING_PATTERN.exec(line);
    if (categoryMatch) {
      if (!currentRelease) {
        throw new Error(`Changelog category appears outside a release at line ${lineNumber + 1}`);
      }
      const category = categoryMatch[1];
      if (!CATEGORY_NAMES.includes(category)) {
        throw new Error(`Unsupported changelog category at line ${lineNumber + 1}: ${category}`);
      }
      if (currentRelease.sections.some((section) => section.category === category)) {
        throw new Error(`Duplicate changelog category at line ${lineNumber + 1}: ${category}`);
      }

      currentSection = { category, entries: [] };
      currentRelease.sections.push(currentSection);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!currentSection) {
        throw new Error(`Changelog entry has no category at line ${lineNumber + 1}`);
      }
      const entry = line.slice(2).trim();
      if (!entry) throw new Error(`Changelog entry is empty at line ${lineNumber + 1}`);
      currentSection.entries.push(entry);
      continue;
    }

    if (line.startsWith("#")) {
      throw new Error(`Unsupported changelog heading at line ${lineNumber + 1}: ${line}`);
    }
    if (currentRelease) {
      throw new Error(`Unsupported changelog content at line ${lineNumber + 1}: ${line}`);
    }
  }

  for (const release of releases) {
    if (release.sections.length === 0) {
      throw new Error(`Released changelog version has no categories: ${release.version}`);
    }
    if (release.sections.some((section) => section.entries.length === 0)) {
      const emptySection = release.sections.find((section) => section.entries.length === 0);
      throw new Error(
        `Released changelog category has no entries: ${release.version} / ${emptySection.category}`,
      );
    }
  }

  return releases
    .map(({ sections, version }) => ({ sections, version }))
    .sort((left, right) =>
      compareVersions(parseVersion(left.version), parseVersion(right.version)),
    );
}

function changelogDigest(markdown) {
  return createHash("sha256").update(markdown).digest("hex");
}

function isGeneratedChangelogCurrent(markdown, generatedModule) {
  const header = `// Generated from CHANGELOG.md (sha256: ${changelogDigest(markdown)}). Do not edit manually.`;
  return generatedModule.startsWith(`${header}\n`);
}

function renderGeneratedModule(releases, markdown) {
  const header = `// Generated from CHANGELOG.md (sha256: ${changelogDigest(markdown)}). Do not edit manually.`;
  return `${header}\ntype ChangelogCategory = "Added" | "Changed" | "Fixed" | "Deprecated" | "Removed" | "Security";\n\ninterface GeneratedChangelogRelease {\n  sections: readonly { category: ChangelogCategory; entries: readonly string[] }[];\n  version: string;\n}\n\nexport const CHANGELOG: readonly GeneratedChangelogRelease[] = ${JSON.stringify(releases, null, 2)};\n`;
}

async function generateChangelog({ onlyIfNeeded = false } = {}) {
  const markdown = await readFile(changelogPath, "utf8");
  if (onlyIfNeeded) {
    const generatedModule = await readFile(outputPath, "utf8").catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (generatedModule && isGeneratedChangelogCurrent(markdown, generatedModule)) return null;
  }

  const releases = parseChangelog(markdown);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderGeneratedModule(releases, markdown), "utf8");
  return releases;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const releases = await generateChangelog({
      onlyIfNeeded: process.argv.includes("--if-needed"),
    });

    if (releases) console.log(`Generated changelog data for ${releases.length} released versions.`);
  } catch (error) {
    console.error(`changelog:generate: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

export {
  CATEGORY_NAMES,
  compareVersions,
  generateChangelog,
  isGeneratedChangelogCurrent,
  parseChangelog,
  parseVersion,
};
