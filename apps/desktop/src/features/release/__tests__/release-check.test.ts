import { afterEach, describe, expect, it, vi } from "vitest";

import { checkForUpdate, isNewerVersion } from "../release-check";

describe("release checks", () => {
  afterEach(() => vi.restoreAllMocks());

  it("compares release versions without the v prefix", () => {
    expect(isNewerVersion("0.1.0", "v0.2.0")).toBe(true);
    expect(isNewerVersion("1.2.0", "1.2.0")).toBe(false);
    expect(isNewerVersion("1.2.1", "1.2.0")).toBe(false);
  });

  it("returns a newer stable release", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tag_name: "v0.2.0",
          html_url: "https://github.com/vakot/clipkit/releases/tag/v0.2.0",
          name: "ClipKit 0.2.0",
          draft: false,
          prerelease: false,
        }),
        { status: 200 },
      ),
    );

    await expect(checkForUpdate("0.1.0")).resolves.toEqual({
      currentVersion: "0.1.0",
      version: "0.2.0",
      name: "ClipKit 0.2.0",
      url: "https://github.com/vakot/clipkit/releases/tag/v0.2.0",
    });
  });

  it("ignores prereleases and the current version", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tag_name: "v0.1.0-beta.1",
          html_url: "https://github.com/vakot/clipkit/releases/tag/v0.1.0-beta.1",
          name: "Beta",
          draft: false,
          prerelease: true,
        }),
        { status: 200 },
      ),
    );

    await expect(checkForUpdate("0.1.0")).resolves.toBeNull();
  });
});
