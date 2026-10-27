import { vi } from "vitest";

import { RELEASE_DOWNLOAD_URL_PREFIX } from "../consts/links.consts";

function releaseAsset(name: string, size: number) {
  return { browser_download_url: `${RELEASE_DOWNLOAD_URL_PREFIX}v1.15.0/${name}`, name, size };
}

/** The real v1.15.0 release: Windows installers, their updater signatures, and `latest.json`. */
const windowsOnlyRelease = {
  assets: [
    releaseAsset("EasyTrim_1.15.0_windows_x64_msi.msi", 7_983_104),
    releaseAsset("EasyTrim_1.15.0_windows_x64_msi.msi.sig", 428),
    releaseAsset("EasyTrim_1.15.0_windows_x64_nsis.exe", 6_190_491),
    releaseAsset("EasyTrim_1.15.0_windows_x64_nsis.exe.sig", 428),
    releaseAsset("latest.json", 728),
  ],
  html_url: "https://github.com/vakot/easytrim-editor/releases/tag/v1.15.0",
  published_at: "2026-10-18T21:41:48Z",
  tag_name: "v1.15.0",
};

/** Every platform and format the release workflow can publish. */
const allPlatformsRelease = {
  ...windowsOnlyRelease,
  assets: [
    ...windowsOnlyRelease.assets,
    releaseAsset("EasyTrim_1.15.0_macos_x64_dmg.dmg", 9_100_000),
    releaseAsset("EasyTrim_1.15.0_macos_arm64_dmg.dmg", 8_700_000),
    releaseAsset("EasyTrim_1.15.0_macos_arm64_app.app.tar.gz", 8_600_000),
    releaseAsset("EasyTrim_1.15.0_linux_x64_deb.deb", 7_400_000),
    releaseAsset("EasyTrim_1.15.0_linux_x64_appimage.AppImage", 82_000_000),
  ],
};

/** Answers the landing page's GitHub requests, or fails them all with `status`. */
function stubGithub({
  release = windowsOnlyRelease as object,
  stars = 1,
  status = 200,
}: { release?: object; stars?: number; status?: number } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith("/releases/latest") ? release : { stargazers_count: stars };
    return status === 200 ? Response.json(body) : new Response(null, { status });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const userAgents = {
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  linux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  macos:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
} as const;

/** Makes the page see a visitor on `platform`, optionally with a Mac processor client hint. */
function stubVisitor(platform: keyof typeof userAgents, macArchitecture?: "arm" | "x86") {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgents[platform]);
  vi.spyOn(navigator, "platform", "get").mockReturnValue("");
  if (macArchitecture) {
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      value: {
        getHighEntropyValues: () => Promise.resolve({ architecture: macArchitecture }),
        mobile: false,
        platform: "macOS",
      },
    });
  }
}

function resetVisitor() {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "userAgentData");
}

export {
  allPlatformsRelease,
  releaseAsset,
  resetVisitor,
  stubGithub,
  stubVisitor,
  userAgents,
  windowsOnlyRelease,
};
