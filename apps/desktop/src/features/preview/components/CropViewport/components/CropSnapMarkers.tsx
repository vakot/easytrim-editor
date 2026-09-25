import { motion, type Transition } from "motion/react";

import { QUARTER_SNAP_POINTS } from "@/lib/interaction/snap-points.consts";

interface CropSnapMarkersProps {
  aspectRatio: number;
  transition: Transition;
  visible: boolean;
  widthTarget: string;
}

function CropSnapMarkers({ aspectRatio, transition, visible, widthTarget }: CropSnapMarkersProps) {
  return (
    <motion.div
      animate={{ aspectRatio, opacity: visible ? 1 : 0, width: widthTarget }}
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-1/2 z-10"
      data-crop-snap-markers
      data-output-aspect-ratio={aspectRatio}
      data-output-width-target={widthTarget}
      data-visible={visible}
      initial={false}
      style={{ x: "-50%", y: "-50%" }}
      transition={transition}
    >
      {QUARTER_SNAP_POINTS.map((point) => (
        <span
          className="absolute h-2 w-px -translate-x-1/2 bg-muted-foreground/70"
          data-crop-snap-marker="top"
          key={`top-${point}`}
          style={{ left: `${point * 100}%`, top: -12 }}
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
          style={{ left: -12, top: `${point * 100}%` }}
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
    </motion.div>
  );
}

function formatPercent(point: number): string {
  return `${point * 100}%`;
}

export { CropSnapMarkers };
