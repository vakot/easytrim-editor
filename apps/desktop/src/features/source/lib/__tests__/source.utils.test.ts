import { describe, expect, it } from "vitest";

import { getPathDirectories } from "../source.utils";

describe("getPathDirectories", () => {
  it("returns cumulative directories for a Windows source path", () => {
    expect(getPathDirectories("C:/Media/Clips/video.mp4")).toEqual([
      { name: "C:", path: "C:/" },
      { name: "Media", path: "C:/Media" },
      { name: "Clips", path: "C:/Media/Clips" },
    ]);
  });

  it("returns the root directory for a Unix source path", () => {
    expect(getPathDirectories("/Media/video.mp4")).toEqual([{ name: "Media", path: "/Media" }]);
  });
});
