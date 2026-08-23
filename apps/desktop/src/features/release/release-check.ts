export const RELEASES_API_URL =
  "https://api.github.com/repos/vakot/easytrim-editor/releases/latest";
export const REPOSITORY_RELEASES_URL = "https://github.com/vakot/easytrim-editor/releases";

export interface GithubRelease {
  tag_name: string;
  html_url: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
}

export interface AvailableUpdate {
  currentVersion: string;
  version: string;
  name: string;
  url: string;
}

function parseVersion(value: string): number[] | null {
  const match = value
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

export function isNewerVersion(currentVersion: string, candidateVersion: string): boolean {
  const current = parseVersion(currentVersion);
  const candidate = parseVersion(candidateVersion);
  if (!current || !candidate) return false;

  for (let index = 0; index < current.length; index += 1) {
    if (candidate[index] !== current[index]) {
      return (candidate[index] ?? 0) > (current[index] ?? 0);
    }
  }

  return false;
}

export async function checkForUpdate(
  currentVersion: string,
  signal?: AbortSignal,
): Promise<AvailableUpdate | null> {
  const response = await fetch(RELEASES_API_URL, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!response.ok) throw new Error(`GitHub release check failed: ${response.status}`);

  const release = (await response.json()) as Partial<GithubRelease>;
  if (
    typeof release.tag_name !== "string" ||
    typeof release.html_url !== "string" ||
    release.draft ||
    release.prerelease ||
    !isNewerVersion(currentVersion, release.tag_name)
  ) {
    return null;
  }

  return {
    currentVersion,
    version: release.tag_name.replace(/^v/i, ""),
    name: typeof release.name === "string" && release.name.trim() ? release.name : release.tag_name,
    url: release.html_url,
  };
}
