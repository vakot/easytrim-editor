import type { PointerEvent } from "react";

import type { CropHandle, CropRect } from "../utils/crop-geometry";

interface CropSelectionProps {
  crop: CropRect;
  viewport: { width: number; height: number };
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

export function CropSelection({ crop, viewport, onPointerDown }: CropSelectionProps) {
  return (
    <div
      className="absolute border-2 border-primary bg-primary/10"
      style={{
        width: viewport.width * crop.width,
        height: viewport.height * crop.height,
        left: `calc(50% - ${viewport.width / 2}px + ${viewport.width * crop.x}px)`,
        top: `calc(50% - ${viewport.height / 2}px + ${viewport.height * crop.y}px)`,
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => onPointerDown(event, "move")}
    >
      <div
        aria-hidden="true"
        data-crop-rule-of-thirds
        className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
      >
        <span className="col-start-2 row-span-3 border-x border-primary/60" />
        <span className="col-span-3 row-start-2 border-y border-primary/60" />
      </div>
      {HANDLES.map(({ handle, label, className }) => (
        <button
          key={handle}
          type="button"
          aria-label={label}
          className={`absolute size-4 rounded-full border-2 border-background bg-primary shadow-sm ${className}`}
          onPointerDown={(event) => onPointerDown(event, handle)}
        />
      ))}
      <span className="pointer-events-none absolute -top-8 left-0 rounded bg-background/90 px-2 py-1 text-xs text-foreground shadow">
        Drag to reposition. Drag edges or corners to crop.
      </span>
    </div>
  );
}
