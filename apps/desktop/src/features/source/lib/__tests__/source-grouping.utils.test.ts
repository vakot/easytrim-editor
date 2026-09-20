import { describe, expect, it } from "vitest";

import type { EditingInstance } from "@/domain/editing-instance";

import { getSourceFolderPath, groupSourcesByFolder } from "../source-grouping.utils";

function source(id: string, sourcePath: string): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: {
      audio: { master: { enabled: true, volumePercent: 100 }, mergeAudio: false, tracks: [] },
      crop: null,
      rotation: 0,
      source: { displayName: id, sourcePath },
      trim: { kind: "full-source" },
    },
    sourceAvailability: "available",
  };
}

describe("source grouping utilities", () => {
  it.each([
    ["C:/Media/first.mp4", "C:/Media"],
    ["C:\\Media\\first.mp4", "C:\\Media"],
    ["C:\\first.mp4", "C:\\"],
    ["/media/first.mp4", "/media"],
    ["first.mp4", ""],
  ])("extracts the folder from %s", (sourcePath, expected) => {
    expect(getSourceFolderPath(sourcePath)).toBe(expected);
  });

  it("groups sources by folder while preserving source order", () => {
    const sources = [
      source("first", "C:/Media/first.mp4"),
      source("second", "C:/Other/second.mp4"),
      source("third", "C:\\Media\\third.mp4"),
    ];

    expect(
      groupSourcesByFolder(sources).map(({ label, items }) => [label, items.map(({ id }) => id)]),
    ).toEqual([
      ["C:/Media", ["first", "third"]],
      ["C:/Other", ["second"]],
    ]);
  });
});
