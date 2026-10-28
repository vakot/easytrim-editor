import { LATEST_RELEASE_URL, RELEASES_URL, REPOSITORY_API_URL } from "../consts/links.consts";

import { type Installer, isRecord, readInstaller } from "./installers.utils";

type LatestRelease = {
  installers: readonly Installer[];
  /** ISO 8601, when GitHub reports it. */
  publishedAt: string | undefined;
  url: string;
  version: string;
};

/** Unauthenticated, so GitHub's public rate limit of 60 requests an hour per visitor applies. */
async function fetchRepositoryApi(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${REPOSITORY_API_URL}${path}`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });

  if (!response.ok) throw new Error(`GitHub responded with ${response.status}`);
  return response.json();
}

/** The newest published release, never a draft or prerelease. */
async function fetchLatestRelease(signal: AbortSignal): Promise<LatestRelease> {
  const release = await fetchRepositoryApi("/releases/latest", signal);
  if (!isRecord(release) || typeof release.tag_name !== "string") {
    throw new Error("GitHub returned an unexpected release");
  }

  const { assets, html_url: url, published_at: publishedAt, tag_name: version } = release;
  return {
    installers: Array.isArray(assets) ? assets.flatMap(readInstaller) : [],
    publishedAt: typeof publishedAt === "string" ? publishedAt : undefined,
    url: typeof url === "string" && url.startsWith(`${RELEASES_URL}/`) ? url : LATEST_RELEASE_URL,
    version,
  };
}

async function fetchStarCount(signal: AbortSignal): Promise<number> {
  const repository = await fetchRepositoryApi("", signal);
  if (!isRecord(repository) || typeof repository.stargazers_count !== "number") {
    throw new Error("GitHub returned an unexpected repository");
  }
  return repository.stargazers_count;
}

export { fetchLatestRelease, fetchStarCount, type LatestRelease };
