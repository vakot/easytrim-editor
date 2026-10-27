import { describe, expect, it } from "vitest";

import { userAgents } from "../../test/github.fixtures";
import { detectMacArchitecture, detectVisitorPlatform } from "../platform.utils";

function visitor(
  userAgent: string,
  overrides: Partial<Parameters<typeof detectVisitorPlatform>[0]> = {},
) {
  return { maxTouchPoints: 0, platform: "", userAgent, ...overrides };
}

describe("detectVisitorPlatform", () => {
  it.each([
    [userAgents.windows, "windows"],
    [userAgents.macos, "macos"],
    [userAgents.linux, "linux"],
    [userAgents.android, "mobile"],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "mobile",
    ],
    [
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "unknown",
    ],
    ["", "unknown"],
  ])("reads %s as %s", (userAgent, platform) => {
    expect(detectVisitorPlatform(visitor(userAgent))).toBe(platform);
  });

  it("recognizes an iPad asking for the desktop site", () => {
    expect(detectVisitorPlatform(visitor(userAgents.macos, { maxTouchPoints: 5 }))).toBe("mobile");
  });

  it("trusts client hints when the browser sends them", () => {
    expect(
      detectVisitorPlatform(visitor("", { userAgentData: { mobile: false, platform: "Windows" } })),
    ).toBe("windows");
    expect(
      detectVisitorPlatform(
        visitor(userAgents.linux, { userAgentData: { mobile: true, platform: "Android" } }),
      ),
    ).toBe("mobile");
  });
});

describe("detectMacArchitecture", () => {
  const withHint = (getHighEntropyValues: () => Promise<{ architecture?: string }>) =>
    visitor(userAgents.macos, { userAgentData: { getHighEntropyValues } });

  it("reads the processor from client hints", async () => {
    await expect(
      detectMacArchitecture(withHint(() => Promise.resolve({ architecture: "arm" }))),
    ).resolves.toBe("arm64");
    await expect(
      detectMacArchitecture(withHint(() => Promise.resolve({ architecture: "x86" }))),
    ).resolves.toBe("x64");
  });

  it("is unknown without client hints or when the browser declines", async () => {
    await expect(detectMacArchitecture(visitor(userAgents.macos))).resolves.toBeUndefined();
    await expect(
      detectMacArchitecture(withHint(() => Promise.reject(new Error("denied")))),
    ).resolves.toBeUndefined();
  });
});
