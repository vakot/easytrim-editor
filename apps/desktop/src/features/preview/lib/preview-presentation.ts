import type { PreviewGeometry } from "./preview-geometry";

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
export type { PreviewFrameBounds };
