type DesktopPlatform = "linux" | "macos" | "windows";
/** What the page can tell about the visitor's device: a desktop platform, a phone or tablet, or neither. */
type VisitorPlatform = DesktopPlatform | "mobile" | "unknown";
type Architecture = "arm64" | "universal" | "x64";

/** Client hints, available in Chromium-based browsers only. */
type UserAgentData = {
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
  mobile?: boolean;
  platform?: string;
};

type VisitorNavigator = Pick<Navigator, "maxTouchPoints" | "platform" | "userAgent"> & {
  userAgentData?: UserAgentData;
};

const desktopPlatforms: readonly DesktopPlatform[] = ["windows", "macos", "linux"];

const platformNames: Record<DesktopPlatform, string> = {
  linux: "Linux",
  macos: "macOS",
  windows: "Windows",
};

function isDesktopPlatform(platform: VisitorPlatform): platform is DesktopPlatform {
  return (desktopPlatforms as readonly string[]).includes(platform);
}

function detectVisitorPlatform(nav: VisitorNavigator): VisitorPlatform {
  const hints = [nav.userAgentData?.platform, nav.platform, nav.userAgent].join(" ");

  if (nav.userAgentData?.mobile || /android|iphone|ipad|ipod|mobile/i.test(hints)) return "mobile";
  // iPadOS asks for desktop sites and reports itself as a Mac, but Macs have no touch screen.
  if (/mac/i.test(hints)) return nav.maxTouchPoints > 1 ? "mobile" : "macos";
  if (/\bwin/i.test(hints)) return "windows";
  // ChromeOS identifies as X11 too, but cannot run these installers directly.
  if (/cros|chrome os/i.test(hints)) return "unknown";
  if (/linux|x11/i.test(hints)) return "linux";
  return "unknown";
}

/**
 * Whether a Mac has Apple silicon or an Intel processor. Every Mac browser reports "Intel" in its
 * user agent, so only the client hints of Chromium-based browsers can tell; elsewhere it is unknown.
 */
async function detectMacArchitecture(nav: VisitorNavigator): Promise<Architecture | undefined> {
  try {
    const values = await nav.userAgentData?.getHighEntropyValues?.(["architecture"]);
    if (values?.architecture === "arm") return "arm64";
    if (values?.architecture === "x86") return "x64";
  } catch {
    // The browser may decline to share the hint; the choice is then left to the visitor.
  }
  return undefined;
}

export {
  type Architecture,
  type DesktopPlatform,
  desktopPlatforms,
  detectMacArchitecture,
  detectVisitorPlatform,
  isDesktopPlatform,
  platformNames,
  type VisitorPlatform,
};
