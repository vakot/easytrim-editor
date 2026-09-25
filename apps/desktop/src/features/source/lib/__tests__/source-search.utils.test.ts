import { describe, expect, it } from "vitest";

import type { EditingInstance } from "@/domain/editing-instance";

import { searchSources } from "../source-search.utils";

function source(
  id: string,
  displayName: string,
  sourcePath = `C:/Media/${displayName}`,
): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: {
      audio: { master: { enabled: true, volumePercent: 100 }, mergeAudio: false, tracks: [] },
      crop: null,
      rotation: 0,
      source: { displayName, sourcePath },
      trim: { kind: "full-source" },
    },
    sourceAvailability: "available",
  };
}

describe("source search", () => {
  const featured = source(
    "war",
    "War Thunder Enemy destroyed moment 2026.mp4",
    "C:/Media/War Thunder Enemy destroyed moment 2026.mp4",
  );

  const sources = [
    source("first", "War thunder clips 2025.mp4"),
    featured,
    source("third", "Enemy destroyed compilation.mp4"),
  ];

  it.each(["war thunder", "war t 2026", "war thudner", "enemy destroyd"])(
    "finds the featured source for %s",
    (query) => {
      expect(searchSources(sources, query).map(({ source: result }) => result.id)).toContain("war");
    },
  );

  it("searches display names and full paths and returns ranges for the matched fields", () => {
    const nameMatch = searchSources([featured], "thunder enemy")[0];
    expect(nameMatch?.displayNameRanges).toEqual([
      [4, 10],
      [12, 16],
    ]);

    const pathMatch = searchSources([featured], "C:/Media")[0];
    expect(pathMatch?.sourcePathRanges).toEqual([
      [0, 0],
      [3, 7],
    ]);
  });

  it("ranks stronger results before weaker fuzzy matches", () => {
    const candidates = [source("weak", "War thunder reference"), featured];
    expect(searchSources(candidates, "war thunder enemy destroyed 2026")[0]?.source.id).toBe("war");
  });

  it("keeps the supplied order for a blank query", () => {
    expect(searchSources(sources, "   ").map(({ source: result }) => result.id)).toEqual([
      "first",
      "war",
      "third",
    ]);
  });

  it("returns no results for an unrelated query", () => {
    expect(searchSources(sources, "completely unrelated zebra")).toEqual([]);
  });
});
