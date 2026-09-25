import { motion, type Transition, useIsPresent } from "motion/react";
import type { PointerEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { CropRect } from "@/domain/crop";

import type { CropHandle } from "../../../lib/crop-geometry.utils";

interface CropSelectionProps {
  crop: CropRect;
  fadeTransition: Transition;
  flipHorizontal: boolean;
  flipVertical: boolean;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>, handle: CropHandle) => void;
  selectionRef: RefObject<HTMLDivElement | null>;
}

const HANDLES: Array<{ className: string; handle: Exclude<CropHandle, "move"> }> = [
  {
    handle: "top-left",
    className: "-left-2 -top-2",
  },
  {
    handle: "top",
    className: "-top-2 left-1/2 -translate-x-1/2",
  },
  {
    handle: "top-right",
    className: "-right-2 -top-2",
  },
  {
    handle: "right",
    className: "-right-2 top-1/2 -translate-y-1/2",
  },
  {
    handle: "bottom-right",
    className: "-bottom-2 -right-2",
  },
  {
    handle: "bottom",
    className: "-bottom-2 left-1/2 -translate-x-1/2",
  },
  {
    handle: "bottom-left",
    className: "-bottom-2 -left-2",
  },
  {
    handle: "left",
    className: "-left-2 top-1/2 -translate-y-1/2",
  },
];

function CropSelection({
  crop,
  fadeTransition,
  flipHorizontal,
  flipVertical,
  isDragging,
  onPointerDown,
  selectionRef,
}: CropSelectionProps) {
  const { t } = useTranslation();
  const isPresent = useIsPresent();
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
      animate={{ opacity: 1 }}
      className="absolute border-2 border-primary bg-primary/10"
      data-crop-selection
      data-selection-geometry="normalized"
      exit={{ opacity: 0, pointerEvents: "none" }}
      initial={{ opacity: 0 }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => onPointerDown(event, "move")}
      ref={selectionRef}
      style={{
        height: `${crop.height * 100}%`,
        left: `${crop.x * 100}%`,
        pointerEvents: isPresent ? "auto" : "none",
        top: `${crop.y * 100}%`,
        width: `${crop.width * 100}%`,
      }}
      transition={{ opacity: fadeTransition }}
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
        const visualHandle = handleAfterFlip(handle, flipHorizontal, flipVertical);
        return (
          <button
            aria-label={handleLabels[visualHandle]}
            className={`absolute z-10 size-4 rounded-full border-2 border-background bg-primary shadow-sm ${className} ${resizeCursor(visualHandle)}`}
            key={handle}
            onPointerDown={(event) => onPointerDown(event, handle)}
            type="button"
          />
        );
      })}
    </motion.div>
  );
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
