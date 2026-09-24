import { describe, expect, it } from "vitest";

import type { CropRect } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import { previewGeometryFor } from "../preview-geometry";

const FULL: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const ROTATIONS: RotationDegrees[] = [0, 90, 180, 270];

describe("previewGeometryFor", () => {
  it.each(ROTATIONS)("calculates full crop geometry at %i degrees", (rotation) => {
    const geometry = previewGeometryFor(1920, 1080, FULL, rotation)!;
    const quarterTurn = rotation === 90 || rotation === 270;

    expect(geometry.sourceAspect).toBeCloseTo(16 / 9);
    expect(geometry.rotatedAspect).toBeCloseTo(quarterTurn ? 9 / 16 : 16 / 9);
    expect(geometry.outputAspect).toBeCloseTo(geometry.rotatedAspect);
    expect(geometry.sourceWithinCrop).toEqual({
      width: "100%",
      height: "100%",
      left: "0%",
      top: "0%",
    });
  });

  it.each([
    ["left", { x: 0, y: 0.25, width: 0.5, height: 0.5 }],
    ["right", { x: 0.5, y: 0.25, width: 0.5, height: 0.5 }],
    ["top", { x: 0.25, y: 0, width: 0.5, height: 0.5 }],
    ["bottom", { x: 0.25, y: 0.5, width: 0.5, height: 0.5 }],
    ["arbitrary", { x: 0.2, y: 0.1, width: 0.6, height: 0.5 }],
  ] as Array<[string, CropRect]>)("keeps %s crop in rotated-source coordinates for every rotation", (_, crop) => {
    for (const rotation of ROTATIONS) {
      const geometry = previewGeometryFor(1920, 1080, crop, rotation)!;
      const rotatedAspect = rotation === 90 || rotation === 270 ? 9 / 16 : 16 / 9;

      expect(geometry.outputAspect).toBeCloseTo(rotatedAspect * crop.width / crop.height);
      expect(geometry.sourceWithinCrop).toEqual({
        width: `${100 / crop.width}%`,
        height: `${100 / crop.height}%`,
        left: `${(-crop.x / crop.width) * 100}%`,
        top: `${(-crop.y / crop.height) * 100}%`,
      });
    }
  });

  it("maps a rotated right-half crop to the right half of the original source", () => {
    const rightHalfAfterClockwiseRotation: CropRect = {
      x: 0,
      y: 0.5,
      width: 1,
      height: 0.5,
    };

    expect(previewGeometryFor(1920, 1080, rightHalfAfterClockwiseRotation, 90)).toMatchObject({
      outputAspect: (9 / 16) * 2,
      sourceWithinCrop: {
        width: "100%",
        height: "200%",
        left: "0%",
        top: "-100%",
      },
    });
  });

  it("does not depend on preview container pixel dimensions", () => {
    expect(previewGeometryFor(1920, 1080, FULL, 90)).toEqual(
      previewGeometryFor(1920, 1080, FULL, 90),
    );
  });

  it("rejects dimensions that cannot define source geometry", () => {
    expect(previewGeometryFor(0, 1080, FULL, 0)).toBeNull();
    expect(previewGeometryFor(1920, 1080, { ...FULL, width: 0 }, 0)).toBeNull();
  });
});
