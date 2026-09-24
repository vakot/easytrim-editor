import type { CropRect } from "@/domain/crop";
import { isQuarterTurn, type RotationDegrees } from "@/domain/rotation";

interface PreviewGeometry {
  outputAspect: number;
  rotatedAspect: number;
  sourceAspect: number;
  sourceWithinCrop: {
    height: string;
    left: string;
    top: string;
    width: string;
  };
}

function previewGeometryFor(
  sourceWidth: number,
  sourceHeight: number,
  crop: CropRect,
  rotation: RotationDegrees,
): PreviewGeometry | null {
  if (sourceWidth <= 0 || sourceHeight <= 0 || crop.width <= 0 || crop.height <= 0) return null;

  const sourceAspect = sourceWidth / sourceHeight;
  const rotatedAspect = isQuarterTurn(rotation) ? 1 / sourceAspect : sourceAspect;

  return {
    sourceAspect,
    rotatedAspect,
    outputAspect: rotatedAspect * (crop.width / crop.height),
    sourceWithinCrop: {
      width: `${(100 / crop.width).toString()}%`,
      height: `${(100 / crop.height).toString()}%`,
      left: `${((-crop.x / crop.width) * 100).toString()}%`,
      top: `${((-crop.y / crop.height) * 100).toString()}%`,
    },
  };
}

export { previewGeometryFor };
export type { PreviewGeometry };
