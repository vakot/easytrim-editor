import { QUARTER_SNAP_POINTS } from "@/lib/interaction/snap-points.consts";

import type { CropFrame } from "../lib/crop-frame.utils";

interface CropSnapMarkersProps {
  frame: CropFrame;
}

export function CropSnapMarkers({ frame }: CropSnapMarkersProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
      data-crop-snap-markers
    >
      {QUARTER_SNAP_POINTS.map((point) => (
        <span
          className="absolute h-2 w-px -translate-x-1/2 bg-muted-foreground/70"
          data-crop-snap-marker="top"
          key={`top-${point}`}
          style={{ left: frame.left + frame.width * point, top: frame.top - 12 }}
        >
          <span
            className="absolute bottom-full left-1/2 -translate-x-1/2 pb-0.5 text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground"
            data-crop-snap-label="top"
          >
            {formatPercent(point)}
          </span>
        </span>
      ))}
      {QUARTER_SNAP_POINTS.map((point) => (
        <span
          className="absolute h-px w-2 -translate-y-1/2 bg-muted-foreground/70"
          data-crop-snap-marker="left"
          key={`left-${point}`}
          style={{ left: frame.left - 12, top: frame.top + frame.height * point }}
        >
          <span
            className="text absolute top-1/2 right-full -translate-y-1/2 rotate-180 pl-0.75 text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground"
            data-crop-snap-label="left"
            style={{ writingMode: "vertical-lr" }}
          >
            {formatPercent(point)}
          </span>
        </span>
      ))}
    </div>
  );
}

function formatPercent(point: number): string {
  return `${point * 100}%`;
}
