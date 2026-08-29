import type { PointerEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { CropFrame } from "../lib/crop-frame.utils";
import type { CropHandle } from "../lib/crop-geometry.utils";

interface CropSelectionProps {
  enterFrom: CropFrame | null;
  frame: CropFrame;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>, handle: CropHandle) => void;
  selectionRef: RefObject<HTMLDivElement | null>;
}

const HANDLES: Array<{ className: string; handle: Exclude<CropHandle, "move"> }> = [
  {
    handle: "top-left",
    className: "-left-2 -top-2 cursor-nwse-resize",
  },
  {
    handle: "top",
    className: "-top-2 left-1/2 -translate-x-1/2 cursor-ns-resize",
  },
  {
    handle: "top-right",
    className: "-right-2 -top-2 cursor-nesw-resize",
  },
  {
    handle: "right",
    className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize",
  },
  {
    handle: "bottom-right",
    className: "-bottom-2 -right-2 cursor-nwse-resize",
  },
  {
    handle: "bottom",
    className: "-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize",
  },
  {
    handle: "bottom-left",
    className: "-bottom-2 -left-2 cursor-nesw-resize",
  },
  {
    handle: "left",
    className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize",
  },
];

export function CropSelection({
  enterFrom,
  frame,
  isDragging,
  onPointerDown,
  selectionRef,
}: CropSelectionProps) {
  const { t } = useTranslation();
  const displayedFrame = enterFrom ?? frame;
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

  const transition = !isDragging
    ? "transition-[width,height,left,top] duration-200 ease-out motion-reduce:transition-none"
    : "";

  return (
    <div
      className={`absolute border-2 border-primary bg-primary/10 ${transition}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => onPointerDown(event, "move")}
      ref={selectionRef}
      style={{
        width: displayedFrame.width,
        height: displayedFrame.height,
        left: displayedFrame.left,
        top: displayedFrame.top,
      }}
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
      {HANDLES.map(({ className, handle }) => (
        <button
          aria-label={handleLabels[handle]}
          className={`absolute z-10 size-4 rounded-full border-2 border-background bg-primary shadow-sm ${className}`}
          key={handle}
          onPointerDown={(event) => onPointerDown(event, handle)}
          type="button"
        />
      ))}
    </div>
  );
}
