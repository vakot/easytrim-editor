import { motion, type Transition, useIsPresent } from "motion/react";
import type { PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import type { CropRect } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import type { CropHandle } from "../../../lib/crop-geometry.utils";
import { sourceCropForRotation } from "../../../lib/preview-geometry";

interface CropSelectionProps {
  crop: CropRect;
  flipHorizontal: boolean;
  flipVertical: boolean;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>, handle: CropHandle) => void;
  rotation: RotationDegrees;
  transition: Transition;
}

const HANDLES: Array<{ className: string; handle: Exclude<CropHandle, "move"> }> = [
  { handle: "top-left", className: "-left-2 -top-2" },
  { handle: "top", className: "-top-2 left-1/2 -translate-x-1/2" },
  { handle: "top-right", className: "-right-2 -top-2" },
  { handle: "right", className: "-right-2 top-1/2 -translate-y-1/2" },
  { handle: "bottom-right", className: "-bottom-2 -right-2" },
  { handle: "bottom", className: "-bottom-2 left-1/2 -translate-x-1/2" },
  { handle: "bottom-left", className: "-bottom-2 -left-2" },
  { handle: "left", className: "-left-2 top-1/2 -translate-y-1/2" },
];

function CropSelection({
  crop,
  flipHorizontal,
  flipVertical,
  isDragging,
  onPointerDown,
  rotation,
  transition,
}: CropSelectionProps) {
  const { t } = useTranslation();
  const isPresent = useIsPresent();
  const sourceCrop = sourceCropForRotation(crop, rotation);
  const handleLabels: Record<Exclude<CropHandle, "move">, string> = {
    bottom: t("preview.accessibility.crop.bottom"),
    "bottom-left": t("preview.accessibility.crop.bottomLeft"),
    "bottom-right": t("preview.accessibility.crop.bottomRight"),
    left: t("preview.accessibility.crop.left"),
    right: t("preview.accessibility.crop.right"),
    top: t("preview.accessibility.crop.top"),
    "top-left": t("preview.accessibility.crop.topLeft"),
    "top-right": t("preview.accessibility.crop.topRight"),
  };

  return (
    <motion.div
      animate={{ ...selectionRect(sourceCrop), opacity: 1 }}
      className="absolute border-2 border-primary bg-primary/10"
      data-crop-selection
      data-selection-geometry="normalized"
      data-source-crop-height={sourceCrop.height}
      data-source-crop-width={sourceCrop.width}
      data-source-crop-x={sourceCrop.x}
      data-source-crop-y={sourceCrop.y}
      exit={{
        ...selectionRect({ x: 0, y: 0, width: 1, height: 1 }),
        opacity: 0,
        pointerEvents: "none",
      }}
      initial={{ ...selectionRect({ x: 0, y: 0, width: 1, height: 1 }), opacity: 0 }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => onPointerDown(event, "move")}
      style={{ pointerEvents: isPresent ? "auto" : "none" }}
      transition={transition}
    >
      {isDragging ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full opacity-80 mix-blend-difference"
          data-crop-rule-of-thirds
          preserveAspectRatio="none"
          viewBox="0 0 3 3"
        >
          <path
            d="M1 0V3 M2 0V3"
            data-crop-guide="vertical"
            fill="none"
            stroke="white"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 1H3 M0 2H3"
            data-crop-guide="horizontal"
            fill="none"
            stroke="white"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      {HANDLES.map(({ className, handle }) => {
        const modelHandle = handleAfterRotation(handle, rotation);
        const visualHandle = handleAfterFlip(modelHandle, flipHorizontal, flipVertical);
        return (
          <button
            aria-label={handleLabels[visualHandle]}
            className={`absolute z-10 size-4 rounded-full border-2 border-background bg-primary shadow-sm ${className} ${resizeCursor(visualHandle)}`}
            key={handle}
            onPointerDown={(event) => onPointerDown(event, modelHandle)}
            type="button"
          />
        );
      })}
    </motion.div>
  );
}

function selectionRect(crop: CropRect) {
  return {
    height: `${crop.height * 100}%`,
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.width * 100}%`,
  };
}

function handleAfterRotation(
  handle: Exclude<CropHandle, "move">,
  rotation: RotationDegrees,
): Exclude<CropHandle, "move"> {
  let visualHandle = handle;
  for (let turns = rotation / 90; turns > 0; turns -= 1) {
    visualHandle = rotateHandleClockwise(visualHandle);
  }
  return visualHandle;
}

function rotateHandleClockwise(handle: Exclude<CropHandle, "move">): Exclude<CropHandle, "move"> {
  const point = handlePoint(handle);
  const vertical = point.x === 0 ? "" : point.x > 0 ? "bottom" : "top";
  const horizontal = point.y === 0 ? "" : point.y > 0 ? "left" : "right";
  if (vertical && horizontal) return `${vertical}-${horizontal}` as Exclude<CropHandle, "move">;
  return (vertical || horizontal) as Exclude<CropHandle, "move">;
}

function handlePoint(handle: Exclude<CropHandle, "move">) {
  return {
    x: handle.includes("left") ? -1 : handle.includes("right") ? 1 : 0,
    y: handle.includes("top") ? -1 : handle.includes("bottom") ? 1 : 0,
  };
}

function handleAfterFlip(
  handle: Exclude<CropHandle, "move">,
  flipHorizontal: boolean,
  flipVertical: boolean,
): Exclude<CropHandle, "move"> {
  let visualHandle = handle;
  if (flipHorizontal) {
    visualHandle = visualHandle
      .replace("left", "middle")
      .replace("right", "left")
      .replace("middle", "right") as typeof handle;
  }
  if (flipVertical) {
    visualHandle = visualHandle
      .replace("top", "middle")
      .replace("bottom", "top")
      .replace("middle", "bottom") as typeof handle;
  }
  return visualHandle;
}

function resizeCursor(handle: Exclude<CropHandle, "move">): string {
  if (handle === "top" || handle === "bottom") return "cursor-ns-resize";
  if (handle === "left" || handle === "right") return "cursor-ew-resize";
  return handle === "top-left" || handle === "bottom-right"
    ? "cursor-nwse-resize"
    : "cursor-nesw-resize";
}

export { CropSelection };
