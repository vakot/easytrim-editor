import type { CropRect } from "./crop";

export const ROTATION_DEGREES = [0, 90, 180, 270] as const;

export type RotationDegrees = (typeof ROTATION_DEGREES)[number];

function isQuarterTurn(rotation: RotationDegrees): boolean {
  return rotation === 90 || rotation === 270;
}

function isIdentityTransform(
  rotationDegrees: RotationDegrees,
  flipHorizontal: boolean,
  flipVertical: boolean,
): boolean {
  return (
    (rotationDegrees === 0 && !flipHorizontal && !flipVertical) ||
    (rotationDegrees === 180 && flipHorizontal && flipVertical)
  );
}

function normalizeTransformForExport(
  crop: CropRect,
  rotationDegrees: RotationDegrees,
  flipHorizontal: boolean,
  flipVertical: boolean,
) {
  if (!isIdentityTransform(rotationDegrees, flipHorizontal, flipVertical)) {
    return { crop, flipHorizontal, flipVertical, rotationDegrees };
  }

  return {
    crop: rotationDegrees === 180 ? rotateCrop(crop, 180) : crop,
    flipHorizontal: false,
    flipVertical: false,
    rotationDegrees: 0 as const,
  };
}

function rotateCrop(crop: CropRect, rotation: RotationDegrees): CropRect {
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

export { isIdentityTransform, isQuarterTurn, normalizeTransformForExport, rotateCrop };
