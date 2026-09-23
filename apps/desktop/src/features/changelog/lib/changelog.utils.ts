import type { ChangelogRelease } from "../types";

const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseSemanticVersion(version: string): readonly [number, number, number] {
  const match = SEMANTIC_VERSION_PATTERN.exec(version);
  if (!match) {
    throw new Error(`Unsupported semantic version: ${version}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemanticVersions(left: string, right: string): number {
  const [leftMajor, leftMinor, leftPatch] = parseSemanticVersion(left);
  const [rightMajor, rightMinor, rightPatch] = parseSemanticVersion(right);
  const leftParts = [leftMajor, leftMinor, leftPatch];
  const rightParts = [rightMajor, rightMinor, rightPatch];

  for (let index = 0; index < leftParts.length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }

  return 0;
}

function getAvailableChangelog(
  releases: readonly ChangelogRelease[],
  installedVersion: string,
): readonly ChangelogRelease[] {
  return releases.filter(
    (release) => compareSemanticVersions(release.version, installedVersion) <= 0,
  );
}

function getUnseenChangelog(
  releases: readonly ChangelogRelease[],
  lastSeenVersion: string | null,
  installedVersion: string,
): readonly ChangelogRelease[] {
  if (!lastSeenVersion) return [];

  return getAvailableChangelog(releases, installedVersion).filter(
    (release) => compareSemanticVersions(release.version, lastSeenVersion) > 0,
  );
}

interface ChangelogStartupState {
  initializeSeenVersion: string | null;
  unseenReleases: readonly ChangelogRelease[];
}

function getChangelogStartupState(
  releases: readonly ChangelogRelease[],
  lastSeenVersion: string | null,
  installedVersion: string,
): ChangelogStartupState {
  if (!lastSeenVersion) {
    return { initializeSeenVersion: installedVersion, unseenReleases: [] };
  }

  try {
    return {
      initializeSeenVersion: null,
      unseenReleases: getUnseenChangelog(releases, lastSeenVersion, installedVersion),
    };
  } catch {
    return { initializeSeenVersion: installedVersion, unseenReleases: [] };
  }
}

export {
  compareSemanticVersions,
  getAvailableChangelog,
  getChangelogStartupState,
  getUnseenChangelog,
  parseSemanticVersion,
};
export type { ChangelogStartupState };
