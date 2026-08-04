import { QUARTER_SNAP_POINTS, snapToNearestPoint } from "@/lib/interaction/snap-points";

import { MIN_CROP_SIZE, type CropHandle, type CropRect } from "./crop-geometry";

interface SnapThresholds {
  x: number;
  y: number;
}

export function snapCropToGuides(
  crop: CropRect,
  handle: CropHandle,
  thresholds: SnapThresholds,
): CropRect {
  const snappedX = snapHorizontalEdges(crop, handle, thresholds.x);
  return snapVerticalEdges(snappedX, handle, thresholds.y);
}

function snapHorizontalEdges(crop: CropRect, handle: CropHandle, threshold: number): CropRect {
  if (handle === "move") return snapMovedAxis(crop, "x", threshold);
  if (handle.includes("left")) return snapLeadingEdge(crop, "x", threshold);
  if (handle.includes("right")) return snapTrailingEdge(crop, "x", threshold);
  return crop;
}

function snapVerticalEdges(crop: CropRect, handle: CropHandle, threshold: number): CropRect {
  if (handle === "move") return snapMovedAxis(crop, "y", threshold);
  if (handle.includes("top")) return snapLeadingEdge(crop, "y", threshold);
  if (handle.includes("bottom")) return snapTrailingEdge(crop, "y", threshold);
  return crop;
}

function snapMovedAxis(crop: CropRect, axis: "x" | "y", threshold: number): CropRect {
  const length = axis === "x" ? crop.width : crop.height;
  const leading = crop[axis];
  const trailing = leading + length;
  const leadingGuide = snapToNearestPoint(leading, QUARTER_SNAP_POINTS, threshold);
  const trailingGuide = snapToNearestPoint(trailing, QUARTER_SNAP_POINTS, threshold);
  const guide = nearestGuide(leading, trailing, leadingGuide, trailingGuide);

  if (guide === null) return crop;
  const nextLeading = clamp(guide === leadingGuide ? guide : guide - length, 0, 1 - length);
  return axis === "x" ? { ...crop, x: nextLeading } : { ...crop, y: nextLeading };
}

function snapLeadingEdge(crop: CropRect, axis: "x" | "y", threshold: number): CropRect {
  const guide = snapToNearestPoint(crop[axis], QUARTER_SNAP_POINTS, threshold);
  if (guide === null) return crop;
  if (axis === "x") {
    const right = crop.x + crop.width;
    const left = clamp(guide, 0, right - MIN_CROP_SIZE);
    return { ...crop, x: left, width: right - left };
  }
  const bottom = crop.y + crop.height;
  const top = clamp(guide, 0, bottom - MIN_CROP_SIZE);
  return { ...crop, y: top, height: bottom - top };
}

function snapTrailingEdge(crop: CropRect, axis: "x" | "y", threshold: number): CropRect {
  const length = axis === "x" ? crop.width : crop.height;
  const guide = snapToNearestPoint(crop[axis] + length, QUARTER_SNAP_POINTS, threshold);
  if (guide === null) return crop;
  if (axis === "x") {
    const right = clamp(guide, crop.x + MIN_CROP_SIZE, 1);
    return { ...crop, width: right - crop.x };
  }
  const bottom = clamp(guide, crop.y + MIN_CROP_SIZE, 1);
  return { ...crop, height: bottom - crop.y };
}

function nearestGuide(
  leading: number,
  trailing: number,
  leadingGuide: number | null,
  trailingGuide: number | null,
): number | null {
  if (leadingGuide === null) return trailingGuide;
  if (trailingGuide === null) return leadingGuide;
  return Math.abs(leading - leadingGuide) <= Math.abs(trailing - trailingGuide)
    ? leadingGuide
    : trailingGuide;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
