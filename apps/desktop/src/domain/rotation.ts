import type { CropRect } from "./crop";

export const ROTATION_DEGREES = [0, 90, 180, 270] as const;

export type RotationDegrees = (typeof ROTATION_DEGREES)[number];

export function rotateDegrees(
  current: RotationDegrees,
  direction: "clockwise" | "counterclockwise",
): RotationDegrees {
  const offset = direction === "clockwise" ? 1 : -1;
  const nextIndex =
    (ROTATION_DEGREES.indexOf(current) + offset + ROTATION_DEGREES.length) %
    ROTATION_DEGREES.length;
  return ROTATION_DEGREES[nextIndex] ?? 0;
}

export function isQuarterTurn(rotation: RotationDegrees): boolean {
  return rotation === 90 || rotation === 270;
}

export function rotateCrop(crop: CropRect, rotation: RotationDegrees): CropRect {
  switch (rotation) {
    case 90:
      return {
        x: 1 - crop.y - crop.height,
        y: crop.x,
        width: crop.height,
        height: crop.width,
      };
    case 180:
      return {
        x: 1 - crop.x - crop.width,
        y: 1 - crop.y - crop.height,
        width: crop.width,
        height: crop.height,
      };
    case 270:
      return {
        x: crop.y,
        y: 1 - crop.x - crop.width,
        width: crop.height,
        height: crop.width,
      };
    default:
      return crop;
  }
}
