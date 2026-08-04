import { QUARTER_SNAP_POINTS } from "@/lib/interaction/snap-points";

import type { CropFrame } from "../utils/crop-frame";

interface CropSnapMarkersProps {
  frame: CropFrame;
}

export function CropSnapMarkers({ frame }: CropSnapMarkersProps) {
  return (
    <div
      aria-hidden="true"
      data-crop-snap-markers
      className="pointer-events-none absolute inset-0 z-10"
    >
      {QUARTER_SNAP_POINTS.map((point) => (
        <span
          key={`top-${point}`}
          data-crop-snap-marker="top"
          style={{ left: frame.left + frame.width * point, top: frame.top - 12 }}
          className="absolute h-2 w-px -translate-x-1/2 bg-muted-foreground/70"
        >
          <span
            data-crop-snap-label="top"
            className="absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap pb-0.5 text-[0.625rem] leading-none text-muted-foreground"
          >
            {formatPercent(point)}
          </span>
        </span>
      ))}
      {QUARTER_SNAP_POINTS.map((point) => (
        <span
          key={`left-${point}`}
          data-crop-snap-marker="left"
          style={{ left: frame.left - 12, top: frame.top + frame.height * point }}
          className="absolute h-px w-2 -translate-y-1/2 bg-muted-foreground/70"
        >
          <span
            data-crop-snap-label="left"
            className="absolute right-full top-1/2 -translate-y-1/2 rotate-180 text whitespace-nowrap pl-0.75 text-[0.625rem] leading-none text-muted-foreground"
            style={{ writingMode: 'vertical-lr' }}
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
