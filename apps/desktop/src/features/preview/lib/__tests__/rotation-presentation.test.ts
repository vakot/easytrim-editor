import { describe, expect, it } from "vitest";

import type { RotationDegrees } from "@/domain/rotation";

import {
  advanceRotationPresentation,
  initialRotationPresentation,
  type RotationPresentation,
} from "../rotation-presentation";

describe("rotation presentation", () => {
  it.each([
    [0, [90, 180, 270, 0, 90], [90, 180, 270, 360, 450]],
    [0, [270, 180, 90, 0], [-90, -180, -270, -360]],
    [0, [180], [180]],
    [90, [270], [270]],
    [270, [90], [450]],
  ] as Array<[RotationDegrees, RotationDegrees[], number[]]>)(
    "advances from %i through %j to presentation angles %j",
    (initial, changes, expectedAngles) => {
      let state: RotationPresentation = initialRotationPresentation(initial);

      for (const [index, rotation] of changes.entries()) {
        state = advanceRotationPresentation(state, rotation, false);
        expect(state.rotation).toBe(rotation);
        expect(state.angle).toBe(expectedAngles[index]);
      }
    },
  );

  it("initializes restored rotations directly without animating from zero", () => {
    expect(initialRotationPresentation(270)).toEqual({ angle: 270, rotation: 270 });
  });

  it("resolves directly to normalized final state when reduced motion is enabled", () => {
    const current = { angle: 270, rotation: 270 } as const;

    expect(advanceRotationPresentation(current, 0, true)).toEqual({ angle: 0, rotation: 0 });
  });
});
