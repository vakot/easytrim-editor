import { QUARTER_SNAP_POINTS } from "@/lib/interaction/snap-points.consts";

interface CropSnapMarkersProps {
  visible: boolean;
}

function CropSnapMarkers({ visible }: CropSnapMarkersProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-(--preview-transition-duration) ease-in-out data-[visible=true]:opacity-100 motion-reduce:transition-none"
      data-crop-snap-markers
      data-visible={visible}
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
    </div>
  );
}

function formatPercent(point: number): string {
  return `${point * 100}%`;
}

export { CropSnapMarkers };
