import type { PreviewGeometry } from "./preview-geometry";

interface PreviewOutputBounds {
  height: number;
  width: number;
}

const PREVIEW_CROP_INSET_REM = 3.5;

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
  const insetRem = cropIsOpen ? PREVIEW_CROP_INSET_REM : 0;
  const widthScale = quarterTurn ? 100 / aspectRatio : 100;
  const widthInsetRem = quarterTurn ? insetRem / aspectRatio : insetRem;
  const heightScale = quarterTurn ? 100 : aspectRatio * 100;
  const heightInsetRem = quarterTurn ? insetRem : aspectRatio * insetRem;
  return `min(max(0rem, calc(${widthScale}cqw - ${widthInsetRem}rem)), max(0rem, calc(${heightScale}cqh - ${heightInsetRem}rem)))`;
}

function previewOutputBoundsFor(
  viewportWidth: number,
  viewportHeight: number,
  aspectRatio: number,
  cropIsOpen: boolean,
  rootFontSizePx = 16,
): PreviewOutputBounds {
  const insetPx = cropIsOpen ? PREVIEW_CROP_INSET_REM * rootFontSizePx : 0;
  const width = cropIsOpen
    ? Math.min(
        Math.max(0, viewportWidth - insetPx),
        Math.max(0, aspectRatio * viewportHeight - aspectRatio * insetPx),
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
