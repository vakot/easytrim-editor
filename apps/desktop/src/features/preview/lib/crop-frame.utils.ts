import type { CropRect } from "./crop-geometry.utils";

export interface Bounds {
  height: number;
  width: number;
}

export interface CropFrame {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function centerFrame(bounds: Bounds, size: Bounds): CropFrame {
  return {
    width: size.width,
    height: size.height,
    left: bounds.width / 2 - size.width / 2,
    top: bounds.height / 2 - size.height / 2,
  };
}

export function cropFrame(viewport: CropFrame, crop: CropRect): CropFrame {
  return {
    width: viewport.width * crop.width,
    height: viewport.height * crop.height,
    left: viewport.left + viewport.width * crop.x,
    top: viewport.top + viewport.height * crop.y,
  };
}
