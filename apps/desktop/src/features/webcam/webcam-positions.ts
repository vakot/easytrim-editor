import type { WebcamPosition } from "@/lib/tauri/media";
import type { CSSProperties } from "react";

export const WEBCAM_POSITION_PRESETS = [
  {
    value: "topLeft",
    labelKey: "webcam.positions.topLeft",
    insetPercent: 0,
    vertical: "top",
    horizontal: "left",
  },
  {
    value: "topRight",
    labelKey: "webcam.positions.topRight",
    insetPercent: 0,
    vertical: "top",
    horizontal: "right",
  },
  {
    value: "bottomLeft",
    labelKey: "webcam.positions.bottomLeft",
    insetPercent: 0,
    vertical: "bottom",
    horizontal: "left",
  },
  {
    value: "bottomRight",
    labelKey: "webcam.positions.bottomRight",
    insetPercent: 0,
    vertical: "bottom",
    horizontal: "right",
  },
  {
    value: "topLeftOffset",
    labelKey: "webcam.positions.topLeftOffset",
    insetPercent: 8.9,
    vertical: "top",
    horizontal: "left",
  },
  {
    value: "topRightOffset",
    labelKey: "webcam.positions.topRightOffset",
    insetPercent: 8.9,
    vertical: "top",
    horizontal: "right",
  },
  {
    value: "bottomLeftOffset",
    labelKey: "webcam.positions.bottomLeftOffset",
    insetPercent: 8.9,
    vertical: "bottom",
    horizontal: "left",
  },
  {
    value: "bottomRightOffset",
    labelKey: "webcam.positions.bottomRightOffset",
    insetPercent: 8.9,
    vertical: "bottom",
    horizontal: "right",
  },
] as const satisfies ReadonlyArray<{
  value: WebcamPosition;
  labelKey: string;
  insetPercent: number;
  vertical: "top" | "bottom";
  horizontal: "left" | "right";
}>;

export function isWebcamPosition(value: string): value is WebcamPosition {
  return WEBCAM_POSITION_PRESETS.some((preset) => preset.value === value);
}

export function webcamPositionStyle(position: WebcamPosition): CSSProperties {
  const preset = WEBCAM_POSITION_PRESETS.find((candidate) => candidate.value === position);
  if (!preset) return {};
  return {
    [preset.vertical]: `${preset.insetPercent}%`,
    [preset.horizontal]: `${preset.insetPercent}%`,
  };
}
