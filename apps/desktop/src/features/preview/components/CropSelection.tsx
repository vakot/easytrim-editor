import type { PointerEvent, RefObject } from "react";

import type { CropFrame } from "../lib/crop-frame.utils";
import type { CropHandle } from "../lib/crop-geometry.utils";

interface CropSelectionProps {
  frame: CropFrame;
  enterFrom: CropFrame | null;
  isDragging: boolean;
  selectionRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: PointerEvent<HTMLElement>, handle: CropHandle) => void;
}

const HANDLES: Array<{ handle: Exclude<CropHandle, "move">; label: string; className: string }> = [
  {
    handle: "top-left",
    label: "Resize crop from top left",
    className: "-left-2 -top-2 cursor-nwse-resize",
  },
  {
    handle: "top",
    label: "Resize crop from top",
    className: "-top-2 left-1/2 -translate-x-1/2 cursor-ns-resize",
  },
  {
    handle: "top-right",
    label: "Resize crop from top right",
    className: "-right-2 -top-2 cursor-nesw-resize",
  },
  {
    handle: "right",
    label: "Resize crop from right",
    className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize",
  },
  {
    handle: "bottom-right",
    label: "Resize crop from bottom right",
    className: "-bottom-2 -right-2 cursor-nwse-resize",
  },
  {
    handle: "bottom",
    label: "Resize crop from bottom",
    className: "-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize",
  },
  {
    handle: "bottom-left",
    label: "Resize crop from bottom left",
    className: "-bottom-2 -left-2 cursor-nesw-resize",
  },
  {
    handle: "left",
    label: "Resize crop from left",
    className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize",
  },
];

export function CropSelection({
  frame,
  enterFrom,
  isDragging,
  selectionRef,
  onPointerDown,
}: CropSelectionProps) {
  const displayedFrame = enterFrom ?? frame;
  const transition = !isDragging
    ? "transition-[width,height,left,top] duration-200 ease-out motion-reduce:transition-none"
    : "";

  return (
    <div
      ref={selectionRef}
      className={`absolute border-2 border-primary bg-primary/10 ${transition}`}
      style={{
        width: displayedFrame.width,
        height: displayedFrame.height,
        left: displayedFrame.left,
        top: displayedFrame.top,
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => onPointerDown(event, "move")}
    >
      {isDragging ? (
        <svg
          aria-hidden="true"
          data-crop-rule-of-thirds
          className="pointer-events-none absolute inset-0 size-full opacity-80 mix-blend-difference"
          viewBox="0 0 3 3"
          preserveAspectRatio="none"
        >
          <path
            data-crop-guide="vertical"
            d="M1 0V3 M2 0V3"
            fill="none"
            stroke="white"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            data-crop-guide="horizontal"
            d="M0 1H3 M0 2H3"
            fill="none"
            stroke="white"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      {HANDLES.map(({ handle, label, className }) => (
        <button
          key={handle}
          type="button"
          aria-label={label}
          className={`absolute z-10 size-4 rounded-full border-2 border-background bg-primary shadow-sm ${className}`}
          onPointerDown={(event) => onPointerDown(event, handle)}
        />
      ))}
    </div>
  );
}
