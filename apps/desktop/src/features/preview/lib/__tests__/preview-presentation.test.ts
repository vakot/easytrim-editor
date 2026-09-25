import { describe, expect, it } from "vitest";

import {
  previewOutputBoundsFor,
  previewOutputCoordinateAspectFor,
  previewOutputWidthTargetFor,
} from "../preview-presentation";

describe("preview output presentation", () => {
  it("matches the relative contain layout for a normal output", () => {
    expect(previewOutputBoundsFor(800, 600, 16 / 9, false)).toEqual({
      width: 800,
      height: 450,
    });
  });

  it("matches the crop-safe contain layout", () => {
    expect(previewOutputBoundsFor(800, 600, 9 / 16, true)).toEqual({
      width: 306,
      height: 544,
    });
  });

  it("uses one interpolable relative width expression for normal and crop targets", () => {
    expect(previewOutputWidthTargetFor(16 / 9, false, false)).toBe(
      "min(max(0px, calc(100cqw - 0px)), max(0px, calc(177.77777777777777cqh - 0px)))",
    );
    expect(previewOutputWidthTargetFor(9 / 16, true, false)).toBe(
      "min(max(0px, calc(100cqw - 56px)), max(0px, calc(56.25cqh - 31.5px)))",
    );
    expect(previewOutputWidthTargetFor(9 / 16, true, true)).toBe(
      "min(max(0px, calc(177.77777777777777cqw - 99.55555555555556px)), max(0px, calc(100cqh - 56px)))",
    );
  });

  it("sizes quarter-turn output in the source coordinate aspect", () => {
    expect(previewOutputCoordinateAspectFor(9 / 16, true)).toBe(16 / 9);
    expect(previewOutputCoordinateAspectFor(16 / 9, false)).toBe(16 / 9);
  });
});
