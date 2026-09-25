import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CropRect } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import { usePreviewPresentation } from "../usePreviewPresentation";

const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

function input(rotation: RotationDegrees) {
  return {
    crop: FULL_CROP,
    cropIsOpen: false,
    flipHorizontal: false,
    flipVertical: false,
    rotation,
  };
}

describe("usePreviewPresentation", () => {
  it("returns normalized semantic state and an initial rotation target", () => {
    const { result } = renderHook(() => usePreviewPresentation(input(270), 1, false));

    expect(result.current).toEqual({ ...input(270), rotationAngle: 270 });
  });

  it.each([
    [0, 90, 90],
    [90, 180, 180],
    [180, 270, 270],
    [270, 0, 360],
    [0, 270, -90],
  ] as Array<[RotationDegrees, RotationDegrees, number]>)(
    "calculates the next rotation target for %i to %i",
    (fromRotation, toRotation, targetAngle) => {
      const { rerender, result } = renderHook(
        ({ rotation }) => usePreviewPresentation(input(rotation), 1, false),
        { initialProps: { rotation: fromRotation } },
      );

      rerender({ rotation: toRotation });

      expect(result.current.rotation).toBe(toRotation);
      expect(result.current.rotationAngle).toBe(targetAngle);
    },
  );

  it("continues from the last target when a rotation changes mid-animation", () => {
    const { rerender, result } = renderHook(
      ({ rotation }) => usePreviewPresentation(input(rotation), 1, false),
      { initialProps: { rotation: 0 as RotationDegrees } },
    );

    rerender({ rotation: 90 });
    rerender({ rotation: 180 });

    expect(result.current.rotationAngle).toBe(180);
  });

  it("starts a new source directly at its normalized rotation", () => {
    const { rerender, result } = renderHook(
      ({ rotation, sourceLoadToken }) =>
        usePreviewPresentation(input(rotation), sourceLoadToken, false),
      { initialProps: { rotation: 270 as RotationDegrees, sourceLoadToken: 1 } },
    );

    rerender({ rotation: 0, sourceLoadToken: 2 });

    expect(result.current.rotationAngle).toBe(0);
  });

  it("resolves reduced motion directly to the normalized target", () => {
    const { rerender, result } = renderHook(
      ({ reduceMotion, rotation }) => usePreviewPresentation(input(rotation), 1, reduceMotion),
      { initialProps: { reduceMotion: false, rotation: 270 as RotationDegrees } },
    );

    rerender({ reduceMotion: true, rotation: 0 });

    expect(result.current.rotationAngle).toBe(0);
  });
});
