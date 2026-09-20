import { describe, expect, it } from "vitest";

import type { EditingInstance } from "@/domain/editing-instance";

import { filterSourcesByPath } from "../source-search.utils";

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

describe("filterSourcesByPath", () => {
  const sources = [
    source("first", "C:/Media/Project/first.mp4"),
    source("second", "C:/Media/Other/second.mkv"),
  ];

  it("filters by a case-insensitive path substring", () => {
    expect(filterSourcesByPath(sources, " project/").map(({ id }) => id)).toEqual(["first"]);
  });

  it("returns all sources when the search is blank", () => {
    expect(filterSourcesByPath(sources, "   ")).toBe(sources);
  });

  it("returns no sources when the path does not match", () => {
    expect(filterSourcesByPath(sources, "missing")).toEqual([]);
  });
});
