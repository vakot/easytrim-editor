import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type RefObject,
} from "react";

import { CursorTooltip } from "@/components/ui/cursor-tooltip";

import { CropSelection } from "./components/CropSelection";
import { useCropSelection } from "./hooks/use-crop-selection";
import { isFullCrop } from "./utils/crop-geometry";

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
  onCropToolOpenChange: (isOpen: boolean) => void;
}

interface Bounds {
  width: number;
  height: number;
}

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
  onCropToolOpenChange,
}: CropViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState<Bounds>({ width: 0, height: 0 });
  const [sourceAspectRatio, setSourceAspectRatio] = useState(16 / 9);
  const cropSelection = useCropSelection(containerRef);

  useEffect(() => {
    onCropToolOpenChange(cropSelection.isOpen);
  }, [cropSelection.isOpen, onCropToolOpenChange]);

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

  const cropIsApplied = !cropSelection.isEditing && !isFullCrop(cropSelection.crop);
  const viewportAspectRatio = cropIsApplied
    ? (sourceAspectRatio * cropSelection.crop.width) / cropSelection.crop.height
    : sourceAspectRatio;
  const viewport = containBounds(containerBounds, viewportAspectRatio);
  const sourceFrame = cropIsApplied
    ? {
        width: viewport.width / cropSelection.crop.width,
        height: viewport.height / cropSelection.crop.height,
        left: -(cropSelection.crop.x * viewport.width) / cropSelection.crop.width,
        top: -(cropSelection.crop.y * viewport.height) / cropSelection.crop.height,
      }
    : { width: viewport.width, height: viewport.height, left: 0, top: 0 };
  const viewportTransition = !cropSelection.isDragging
    ? "transition-[width,height,left,top] duration-200 ease-out motion-reduce:transition-none"
    : "";

  return (
    <CursorTooltip
      ref={containerRef}
      className={`group relative size-full bg-preview-surface ${
        cropSelection.isEditing ? "overflow-visible" : "overflow-hidden"
      }`}
      tabIndex={0}
      aria-label="Video crop preview"
      tooltipContent="Click preview to crop"
      disabled={cropSelection.isOpen}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) cropSelection.close();
      }}
      onClick={(event) => {
        if (cropSelection.isOpen) {
          cropSelection.close();
          return;
        }
        event.currentTarget.focus();
        cropSelection.open();
      }}
      onDoubleClick={onTogglePlayback}
      onPointerMove={(event) => cropSelection.moveDrag(event, viewport)}
      onPointerUp={cropSelection.finishDrag}
      onPointerCancel={cropSelection.finishDrag}
    >
      {!cropSelection.isOpen ? (
        <div
          aria-hidden="true"
          data-crop-preview-affordance
          className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 motion-reduce:transition-none"
        />
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
        <video
          ref={videoRef}
          key={sourceUrl}
          data-playback-rate={playbackRate}
          className={`absolute max-w-none cursor-pointer ${viewportTransition}`}
          style={sourceFrame}
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
      </div>
      {cropSelection.isEditing ? (
        <CropSelection
          crop={cropSelection.crop}
          viewport={viewport}
          selectionRef={cropSelection.selectionRef}
          onPointerDown={cropSelection.startDrag}
        />
      ) : null}
    </CursorTooltip>
  );
}

function containBounds(container: Bounds, aspectRatio: number): Bounds {
  if (container.width <= 0 || container.height <= 0) return { width: 0, height: 0 };
  if (container.width / container.height > aspectRatio)
    return { width: container.height * aspectRatio, height: container.height };
  return { width: container.width, height: container.width / aspectRatio };
}
