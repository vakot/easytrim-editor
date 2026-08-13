import type { WebcamPosition } from "@/lib/tauri/media";
import type { CSSProperties } from "react";

export type WebcamCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export const WEBCAM_CORNER_PRESETS = [
  {
    value: "topLeft",
    offsetValue: "topLeftOffset",
    labelKey: "webcam.positions.topLeft",
    vertical: "top",
    horizontal: "left",
  },
  {
    value: "topRight",
    offsetValue: "topRightOffset",
    labelKey: "webcam.positions.topRight",
    vertical: "top",
    horizontal: "right",
  },
  {
    value: "bottomLeft",
    offsetValue: "bottomLeftOffset",
    labelKey: "webcam.positions.bottomLeft",
    vertical: "bottom",
    horizontal: "left",
  },
  {
    value: "bottomRight",
    offsetValue: "bottomRightOffset",
    labelKey: "webcam.positions.bottomRight",
    vertical: "bottom",
    horizontal: "right",
  },
] as const satisfies ReadonlyArray<{
  value: WebcamCorner;
  offsetValue: WebcamPosition;
  labelKey: string;
  vertical: "top" | "bottom";
  horizontal: "left" | "right";
}>;

const WEBCAM_VERTICAL_OFFSET_PERCENT = 8;
const WEBCAM_SHORT_SIDE_PERCENT = 8;

export function webcamOverlayHeight(frame: { width: number; height: number }): number {
  return (Math.min(frame.width, frame.height) * WEBCAM_SHORT_SIDE_PERCENT) / 100;
}

export function isWebcamCorner(value: string): value is WebcamCorner {
  return WEBCAM_CORNER_PRESETS.some((preset) => preset.value === value);
}

export function webcamPositionCorner(position: WebcamPosition): WebcamCorner {
  return (
    WEBCAM_CORNER_PRESETS.find(
      (preset) => preset.value === position || preset.offsetValue === position,
    )?.value ?? "bottomRight"
  );
}

export function webcamPositionIsOffset(position: WebcamPosition): boolean {
  return WEBCAM_CORNER_PRESETS.some((preset) => preset.offsetValue === position);
}

export function webcamPositionFor(corner: WebcamCorner, offset: boolean): WebcamPosition {
  const preset = WEBCAM_CORNER_PRESETS.find((candidate) => candidate.value === corner);
  return offset ? (preset?.offsetValue ?? "bottomRightOffset") : corner;
}

export function webcamPositionStyle(position: WebcamPosition): CSSProperties {
  const preset = WEBCAM_CORNER_PRESETS.find(
    (candidate) => candidate.value === position || candidate.offsetValue === position,
  );
  if (!preset) return {};
  const verticalOffsetPercent = webcamPositionIsOffset(position)
    ? WEBCAM_VERTICAL_OFFSET_PERCENT
    : 0;
  return {
    [preset.vertical]: `${verticalOffsetPercent}%`,
    [preset.horizontal]: "0%",
  };
}
