import type { WebcamPosition } from "@/lib/tauri/media";
import type { CSSProperties } from "react";

export type WebcamCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export const WEBCAM_CORNER_PRESETS = [
  {
    value: "topLeft",
    insetValue: "topLeftOffset",
    labelKey: "webcam.positions.topLeft",
    vertical: "top",
    horizontal: "left",
  },
  {
    value: "topRight",
    insetValue: "topRightOffset",
    labelKey: "webcam.positions.topRight",
    vertical: "top",
    horizontal: "right",
  },
  {
    value: "bottomLeft",
    insetValue: "bottomLeftOffset",
    labelKey: "webcam.positions.bottomLeft",
    vertical: "bottom",
    horizontal: "left",
  },
  {
    value: "bottomRight",
    insetValue: "bottomRightOffset",
    labelKey: "webcam.positions.bottomRight",
    vertical: "bottom",
    horizontal: "right",
  },
] as const satisfies ReadonlyArray<{
  value: WebcamCorner;
  insetValue: WebcamPosition;
  labelKey: string;
  vertical: "top" | "bottom";
  horizontal: "left" | "right";
}>;

const WEBCAM_VERTICAL_INSET_PERCENT = 8.9;

export function isWebcamCorner(value: string): value is WebcamCorner {
  return WEBCAM_CORNER_PRESETS.some((preset) => preset.value === value);
}

export function webcamPositionCorner(position: WebcamPosition): WebcamCorner {
  return (
    WEBCAM_CORNER_PRESETS.find(
      (preset) => preset.value === position || preset.insetValue === position,
    )?.value ?? "bottomRight"
  );
}

export function webcamPositionIsInset(position: WebcamPosition): boolean {
  return WEBCAM_CORNER_PRESETS.some((preset) => preset.insetValue === position);
}

export function webcamPositionFor(corner: WebcamCorner, inset: boolean): WebcamPosition {
  const preset = WEBCAM_CORNER_PRESETS.find((candidate) => candidate.value === corner);
  return inset ? (preset?.insetValue ?? "bottomRightOffset") : corner;
}

export function webcamPositionStyle(position: WebcamPosition): CSSProperties {
  const preset = WEBCAM_CORNER_PRESETS.find(
    (candidate) => candidate.value === position || candidate.insetValue === position,
  );
  if (!preset) return {};
  const verticalInsetPercent = webcamPositionIsInset(position) ? WEBCAM_VERTICAL_INSET_PERCENT : 0;
  return {
    [preset.vertical]: `${verticalInsetPercent}%`,
    [preset.horizontal]: "0%",
  };
}
