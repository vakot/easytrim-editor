export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropHandle =
  | "move"
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
export const MIN_CROP_SIZE = 0.1;

export function moveCrop(crop: CropRect, deltaX: number, deltaY: number): CropRect {
  return {
    ...crop,
    x: clamp(crop.x + deltaX, 0, 1 - crop.width),
    y: clamp(crop.y + deltaY, 0, 1 - crop.height),
  };
}

export function resizeCrop(
  crop: CropRect,
  handle: Exclude<CropHandle, "move">,
  deltaX: number,
  deltaY: number,
): CropRect {
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;

  if (handle.includes("left")) left = clamp(left + deltaX, 0, right - MIN_CROP_SIZE);
  if (handle.includes("right")) right = clamp(right + deltaX, left + MIN_CROP_SIZE, 1);
  if (handle.includes("top")) top = clamp(top + deltaY, 0, bottom - MIN_CROP_SIZE);
  if (handle.includes("bottom")) bottom = clamp(bottom + deltaY, top + MIN_CROP_SIZE, 1);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function isFullCrop(crop: CropRect): boolean {
  return crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
