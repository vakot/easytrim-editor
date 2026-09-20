import { describe, expect, it } from "vitest";

import type { EditingInstance } from "@/domain/editing-instance";

import {
  getSourceFolderPath,
  groupSourcesByFolder,
  groupSourcesByImportedTime,
  groupSourcesByUpdatedTime,
} from "../source-grouping.utils";

function source(
  id: string,
  sourcePath: string,
  updatedAtMicros?: number,
  importedAtMicros?: number,
): EditingInstance {
  return {
    exportAttempts: [],
    id,
    ...(importedAtMicros === undefined ? {} : { importedAtMicros }),
    origin: "source-import",
    snapshot: {
      audio: { master: { enabled: true, volumePercent: 100 }, mergeAudio: false, tracks: [] },
      crop: null,
      rotation: 0,
      source: { displayName: id, sourcePath, ...(updatedAtMicros ? { updatedAtMicros } : {}) },
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
      groupSourcesByFolder(sources).map(({ items, label }) => [label, items.map(({ id }) => id)]),
    ).toEqual([
      ["C:/Media", ["first", "third"]],
      ["C:/Other", ["second"]],
    ]);
  });

  it("groups updated sources by relative and absolute time ranges", () => {
    const now = new Date(2026, 8, 20, 12, 0);
    const micros = (date: Date) => date.getTime() * 1_000;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const older = new Date(now);
    older.setDate(older.getDate() - 2);

    const groups = groupSourcesByUpdatedTime(
      [
        source("minutes-1", "C:/Media/1.mp4", micros(new Date(now.getTime() - 5 * 60_000))),
        source("minutes-2", "C:/Media/2.mp4", micros(new Date(now.getTime() - 5 * 60_000))),
        source("hours", "C:/Media/3.mp4", micros(new Date(now.getTime() - 2 * 60 * 60_000))),
        source("yesterday", "C:/Media/4.mp4", micros(yesterday)),
        source("older", "C:/Media/5.mp4", micros(older)),
        source("unknown", "C:/Media/6.mp4"),
      ],
      "en-US",
      "Unknown",
      now,
    );

    expect(groups.map(({ items, key }) => [key, items.map(({ id }) => id)])).toEqual([
      ["minute:5", ["minutes-1", "minutes-2"]],
      ["hour:2", ["hours"]],
      ["yesterday", ["yesterday"]],
      ["date:2026-8-18", ["older"]],
      ["unknown", ["unknown"]],
    ]);
  });

  it("groups sources from the same import batch together", () => {
    const now = new Date(2026, 8, 20, 12, 0);
    const batchOne = now.getTime() * 1_000;
    const batchOneOther = new Date(now.getTime() - 30_000).getTime() * 1_000;
    const batchTwo = new Date(now.getTime() - 2 * 60 * 60_000).getTime() * 1_000;

    const groups = groupSourcesByImportedTime(
      [
        source("first", "C:/Media/first.mp4", undefined, batchOne),
        source("second", "C:/Media/second.mp4", undefined, batchOne),
        source("other", "C:/Media/other.mp4", undefined, batchOneOther),
        source("third", "C:/Media/third.mp4", undefined, batchTwo),
      ],
      "en-US",
      "Unknown",
      now,
    );

    expect(groups.map(({ items, key }) => [key, items.map(({ id }) => id)])).toEqual([
      [`import:${batchOne}`, ["first", "second"]],
      [`import:${batchOneOther}`, ["other"]],
      [`import:${batchTwo}`, ["third"]],
    ]);
  });
});
