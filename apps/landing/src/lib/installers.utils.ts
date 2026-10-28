import { RELEASE_DOWNLOAD_URL_PREFIX } from "../consts/links.consts";

import type { Architecture, DesktopPlatform } from "./platform.utils";

type Installer = {
  architecture: Architecture;
  /** As published, such as `.AppImage`. */
  extension: string;
  label: string;
  platform: DesktopPlatform;
  /** In bytes. */
  size: number;
  url: string;
};

/**
 * The installers the release workflow publishes, in order of preference within each platform.
 * Anything else attached to a release, such as updater signatures and `latest.json`, is never
 * offered.
 */
const installerFormats: readonly {
  extension: string;
  label: string | Record<Architecture, string>;
  platform: DesktopPlatform;
}[] = [
  { extension: ".exe", label: "Installer", platform: "windows" },
  { extension: ".msi", label: "MSI package", platform: "windows" },
  {
    extension: ".dmg",
    label: { arm64: "Apple silicon", universal: "Apple silicon and Intel", x64: "Intel" },
    platform: "macos",
  },
  { extension: ".AppImage", label: "AppImage", platform: "linux" },
  { extension: ".deb", label: "Debian, Ubuntu", platform: "linux" },
  { extension: ".rpm", label: "Fedora, openSUSE", platform: "linux" },
];

/** Release assets are named `EasyTrim_<version>_<os>_<arch>_<bundle><extension>`. */
function readArchitecture(fileName: string): Architecture {
  if (/[_.-](?:arm64|aarch64)[_.-]/i.test(fileName)) return "arm64";
  if (/[_.-]universal[_.-]/i.test(fileName)) return "universal";
  return "x64";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A GitHub release asset as an installer, or nothing when it is not one this site offers. */
function readInstaller(asset: unknown): Installer[] {
  if (!isRecord(asset)) return [];
  const { browser_download_url: url, name, size } = asset;
  if (typeof name !== "string" || typeof url !== "string" || typeof size !== "number") return [];
  if (!url.startsWith(RELEASE_DOWNLOAD_URL_PREFIX)) return [];

  const format = installerFormats.find(({ extension }) =>
    name.toLowerCase().endsWith(extension.toLowerCase()),
  );

  if (!format) return [];

  const architecture = readArchitecture(name);
  return [
    {
      architecture,
      extension: format.extension,
      label: typeof format.label === "string" ? format.label : format.label[architecture],
      platform: format.platform,
      size,
      url,
    },
  ];
}

/**
 * A platform's installers, best match first: the visitor's architecture, then the preferred format.
 * Without a known architecture, Macs default to Apple silicon and other platforms to x64, the
 * common case for each.
 */
function getPlatformInstallers(
  installers: readonly Installer[],
  platform: DesktopPlatform,
  architecture?: Architecture,
): Installer[] {
  const preferred = architecture ?? (platform === "macos" ? "arm64" : "x64");
  const architectureRank = (installer: Installer) =>
    installer.architecture === preferred ? 0 : installer.architecture === "universal" ? 1 : 2;

  const formatRank = (installer: Installer) =>
    installerFormats.findIndex(({ extension }) => extension === installer.extension);

  return installers
    .filter((installer) => installer.platform === platform)
    .sort(
      (first, second) =>
        architectureRank(first) - architectureRank(second) ||
        formatRank(first) - formatRank(second),
    );
}

export { getPlatformInstallers, type Installer, isRecord, readInstaller };
