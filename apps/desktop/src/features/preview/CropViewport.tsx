import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { CursorTooltip } from "@/components/ui/cursor-tooltip";

interface CropViewportProps {
  sourceUrl: string;
  previewKind: "source" | "proxy";
  sourceLabel: string;
  playbackRate: number;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onTogglePlayback: () => void;
  onLoadedMetadata: () => void;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (seconds: number) => void;
  onEnded: () => void;
  onError: () => void;
}

interface Bounds {
  width: number;
  height: number;
}

const FULL_CROP: PercentCrop = { unit: "%", x: 0, y: 0, width: 100, height: 100 };

export function CropViewport({
  sourceUrl,
  previewKind,
  sourceLabel,
  playbackRate,
  muted,
  videoRef,
  onTogglePlayback,
  onLoadedMetadata,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onError,
}: CropViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState<Bounds>({ width: 0, height: 0 });
  const [sourceAspectRatio, setSourceAspectRatio] = useState(16 / 9);
  const [crop, setCrop] = useState<PercentCrop>(FULL_CROP);
  const [cropToolOpen, setCropToolOpen] = useState(false);
  const [isCropInteracting, setIsCropInteracting] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateBounds = () => {
      const { width, height } = container.getBoundingClientRect();
      setContainerBounds({ width, height });
    };
    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const cropIsApplied = !cropToolOpen && !isFullCrop(crop);
  const viewportAspectRatio = cropIsApplied
    ? (sourceAspectRatio * crop.width) / crop.height
    : sourceAspectRatio;
  const viewport = containBounds(containerBounds, viewportAspectRatio);
  const sourceFrame = cropIsApplied
    ? {
        width: viewport.width / crop.width,
        height: viewport.height / crop.height,
        left: -(crop.x * viewport.width) / crop.width,
        top: -(crop.y * viewport.height) / crop.height,
      }
    : { width: viewport.width, height: viewport.height, left: 0, top: 0 };
  const viewportTransition = !isCropInteracting
    ? "transition-[width,height,left,top] duration-200 ease-out motion-reduce:transition-none"
    : "";

  return (
    <CursorTooltip
      ref={containerRef}
      className="group relative size-full overflow-hidden bg-preview-surface"
      tooltipContent="Click preview to crop"
      disabled={cropToolOpen}
      onClick={() => {
        if (cropToolOpen) return;
        setCropToolOpen(true);
      }}
      onDoubleClick={onTogglePlayback}
    >
      {!cropToolOpen ? (
        <>
          <div
            aria-hidden="true"
            data-crop-preview-affordance
            className="pointer-events-none absolute inset-2 z-10 rounded-md border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-[opacity,transform] duration-150 ease-out group-hover:scale-[0.995] group-hover:opacity-100 motion-reduce:transition-none"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 translate-y-1 rounded-full border border-primary/30 bg-background/85 px-3 py-1 text-xs font-medium text-foreground opacity-0 shadow-sm transition-[opacity,transform] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none"
          >
            Click to crop
          </span>
        </>
      ) : null}
      <div
        className={`absolute overflow-hidden ${viewportTransition}`}
        style={{
          width: viewport.width,
          height: viewport.height,
          left: `calc(50% - ${viewport.width / 2}px)`,
          top: `calc(50% - ${viewport.height / 2}px)`,
        }}
      >
        <ReactCrop
          crop={cropToolOpen ? crop : undefined}
          className={`absolute max-w-none ${viewportTransition}`}
          style={sourceFrame}
          keepSelection
          minWidth={24}
          minHeight={24}
          ruleOfThirds
          onChange={(_pixelCrop, percentageCrop) => setCrop(percentageCrop)}
          onDragStart={() => setIsCropInteracting(true)}
          onDragEnd={() => {
            setIsCropInteracting(false);
            setCropToolOpen(false);
          }}
        >
          <video
            ref={videoRef}
            key={sourceUrl}
            data-playback-rate={playbackRate}
            className="block size-full cursor-pointer"
            src={sourceUrl}
            preload="auto"
            muted={muted}
            playsInline
            aria-label={sourceLabel}
            data-preview-kind={previewKind}
            onLoadedMetadata={(event) => {
              const { videoWidth, videoHeight } = event.currentTarget;
              if (videoWidth > 0 && videoHeight > 0) setSourceAspectRatio(videoWidth / videoHeight);
              onLoadedMetadata();
            }}
            onPlay={onPlay}
            onPause={onPause}
            onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
            onEnded={onEnded}
            onError={onError}
          />
        </ReactCrop>
      </div>
    </CursorTooltip>
  );
}

function isFullCrop(crop: PercentCrop): boolean {
  return crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100;
}

function containBounds(container: Bounds, aspectRatio: number): Bounds {
  if (container.width <= 0 || container.height <= 0) return { width: 0, height: 0 };
  if (container.width / container.height > aspectRatio) {
    return { width: container.height * aspectRatio, height: container.height };
  }
  return { width: container.width, height: container.width / aspectRatio };
}
