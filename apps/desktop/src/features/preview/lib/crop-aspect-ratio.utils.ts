import type { CropRect } from "@/domain/crop";

import { type CropHandle, MIN_CROP_SIZE, resizeCrop } from "./crop-geometry.utils";

const CROP_ASPECT_RATIO_PRESETS = [
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "4:5", ratio: 4 / 5 },
] as const;

type CropAspectRatioPreset = (typeof CROP_ASPECT_RATIO_PRESETS)[number]["label"] | "freeform";

function fitCropToAspectRatio(crop: CropRect, ratio: number): CropRect {
  const cropRatio = crop.width / crop.height;
  const fittedWidth = cropRatio > ratio ? crop.height * ratio : crop.width;
  const minimumWidth = MIN_CROP_SIZE * Math.max(1, ratio);
  const width = Math.max(fittedWidth, minimumWidth);
  const height = width / ratio;
  const x = clamp(crop.x + (crop.width - width) / 2, 0, 1 - width);
  const y = clamp(crop.y + (crop.height - height) / 2, 0, 1 - height);

  return {
    x,
    y,
    width,
    height,
  };
}

function resizeCropToAspectRatio(
  crop: CropRect,
  handle: Exclude<CropHandle, "move">,
  deltaX: number,
  deltaY: number,
  ratio: number,
): CropRect {
  const resized = resizeCrop(crop, handle, deltaX, deltaY);
  const horizontal = handle.includes("left") || handle.includes("right");
  const vertical = handle.includes("top") || handle.includes("bottom");
  const useWidth =
    horizontal && !vertical
      ? true
      : vertical && !horizontal
        ? false
        : Math.abs(resized.width - crop.width) >= Math.abs(resized.height - crop.height) * ratio;

  let width = Math.max(
    useWidth ? resized.width : resized.height * ratio,
    MIN_CROP_SIZE * Math.max(1, ratio),
  );

  let height = width / ratio;

  const maxWidth = handle.includes("left")
    ? crop.x + crop.width
    : handle.includes("right")
      ? 1 - crop.x
      : Math.min(crop.x, 1 - crop.x - crop.width) * 2 + crop.width;

  const maxHeight = handle.includes("top")
    ? crop.y + crop.height
    : handle.includes("bottom")
      ? 1 - crop.y
      : Math.min(crop.y, 1 - crop.y - crop.height) * 2 + crop.height;

  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  width *= scale;
  height *= scale;

  const x = handle.includes("left")
    ? crop.x + crop.width - width
    : handle.includes("right")
      ? crop.x
      : crop.x + (crop.width - width) / 2;

  const y = handle.includes("top")
    ? crop.y + crop.height - height
    : handle.includes("bottom")
      ? crop.y
      : crop.y + (crop.height - height) / 2;

  return { x, y, width, height };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export { CROP_ASPECT_RATIO_PRESETS, fitCropToAspectRatio, resizeCropToAspectRatio };
export type { CropAspectRatioPreset };
