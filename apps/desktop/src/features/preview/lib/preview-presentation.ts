import type { CropRect } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import type { PreviewGeometry } from "./preview-geometry";

interface ResolvedPreviewPresentation {
  crop: CropRect;
  cropIsOpen: boolean;
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: RotationDegrees;
  rotationAngle: number;
}

interface PreviewFrameBounds {
  height: number;
  width: number;
}

function previewFrameAspectFor(geometry: PreviewGeometry, cropIsOpen: boolean): number {
  return cropIsOpen ? geometry.rotatedAspect : geometry.outputAspect;
}

function previewFrameBoundsFor(
  viewportWidth: number,
  viewportHeight: number,
  aspectRatio: number,
  cropIsOpen: boolean,
): PreviewFrameBounds {
  const width = cropIsOpen
    ? Math.min(
        Math.max(0, viewportWidth - 56),
        Math.max(0, aspectRatio * viewportHeight - aspectRatio * 56),
      )
    : Math.min(viewportWidth, aspectRatio * viewportHeight);

  return { height: width / aspectRatio, width };
}

export { previewFrameAspectFor, previewFrameBoundsFor };
export type { PreviewFrameBounds, ResolvedPreviewPresentation };
