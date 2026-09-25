import type { PreviewGeometry } from "./preview-geometry";

interface PreviewOutputBounds {
  height: number;
  width: number;
}

const PREVIEW_CROP_INSET_PX = 56;

function previewOutputAspectFor(geometry: PreviewGeometry, cropIsOpen: boolean): number {
  return cropIsOpen ? geometry.rotatedAspect : geometry.outputAspect;
}

function previewOutputCoordinateAspectFor(aspectRatio: number, quarterTurn: boolean): number {
  return quarterTurn ? 1 / aspectRatio : aspectRatio;
}

function previewOutputWidthTargetFor(
  aspectRatio: number,
  cropIsOpen: boolean,
  quarterTurn: boolean,
): string {
  const inset = cropIsOpen ? PREVIEW_CROP_INSET_PX : 0;
  const widthScale = quarterTurn ? 100 / aspectRatio : 100;
  const widthInset = quarterTurn ? inset / aspectRatio : inset;
  const heightScale = quarterTurn ? 100 : aspectRatio * 100;
  const heightInset = quarterTurn ? inset : aspectRatio * inset;
  return `min(max(0px, calc(${widthScale}cqw - ${widthInset}px)), max(0px, calc(${heightScale}cqh - ${heightInset}px)))`;
}

function previewOutputBoundsFor(
  viewportWidth: number,
  viewportHeight: number,
  aspectRatio: number,
  cropIsOpen: boolean,
): PreviewOutputBounds {
  const width = cropIsOpen
    ? Math.min(
        Math.max(0, viewportWidth - PREVIEW_CROP_INSET_PX),
        Math.max(0, aspectRatio * viewportHeight - aspectRatio * PREVIEW_CROP_INSET_PX),
      )
    : Math.min(viewportWidth, aspectRatio * viewportHeight);

  return { height: width / aspectRatio, width };
}

export {
  previewOutputAspectFor,
  previewOutputBoundsFor,
  previewOutputCoordinateAspectFor,
  previewOutputWidthTargetFor,
};
export type { PreviewOutputBounds };
