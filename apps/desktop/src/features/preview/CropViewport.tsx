import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

import {
  FULL_CROP,
  isFullCrop,
  moveCrop,
  resizeCrop,
  type CropHandle,
  type CropRect,
} from "./utils/crop-geometry";

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

interface DragState {
  handle: CropHandle;
  crop: CropRect;
  startX: number;
  startY: number;
}

interface Bounds {
  width: number;
  height: number;
}

const HANDLES: Array<{ handle: Exclude<CropHandle, "move">; label: string; className: string }> = [
  {
    handle: "top-left",
    label: "Resize crop from top left",
    className: "-left-2 -top-2 cursor-nwse-resize",
  },
  {
    handle: "top-right",
    label: "Resize crop from top right",
    className: "-right-2 -top-2 cursor-nesw-resize",
  },
  {
    handle: "bottom-left",
    label: "Resize crop from bottom left",
    className: "-bottom-2 -left-2 cursor-nesw-resize",
  },
  {
    handle: "bottom-right",
    label: "Resize crop from bottom right",
    className: "-bottom-2 -right-2 cursor-nwse-resize",
  },
];

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
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [hovered, setHovered] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

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

  const editing = hovered || drag !== null;
  const cropIsApplied = !editing && !isFullCrop(crop);
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

  function startDrag(event: PointerEvent<HTMLElement>, handle: CropHandle) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ handle, crop, startX: event.clientX, startY: event.clientY });
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag || viewport.width <= 0 || viewport.height <= 0) return;
    const deltaX = (event.clientX - drag.startX) / viewport.width;
    const deltaY = (event.clientY - drag.startY) / viewport.height;
    setCrop(
      drag.handle === "move"
        ? moveCrop(drag.crop, deltaX, deltaY)
        : resizeCrop(drag.crop, drag.handle, deltaX, deltaY),
    );
  }

  function finishDrag() {
    setDrag(null);
    setHovered(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative size-full overflow-hidden bg-preview-surface"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        if (!drag) setHovered(false);
      }}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div
        className="absolute overflow-hidden"
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
          className="absolute max-w-none cursor-pointer"
          style={sourceFrame}
          src={sourceUrl}
          preload="auto"
          muted={muted}
          playsInline
          aria-label={sourceLabel}
          data-preview-kind={previewKind}
          onClick={onTogglePlayback}
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

      {editing ? (
        <div
          className="absolute border-2 border-primary bg-primary/10"
          style={{
            width: viewport.width * crop.width,
            height: viewport.height * crop.height,
            left: `calc(50% - ${viewport.width / 2}px + ${viewport.width * crop.x}px)`,
            top: `calc(50% - ${viewport.height / 2}px + ${viewport.height * crop.y}px)`,
          }}
          onPointerDown={(event) => startDrag(event, "move")}
        >
          {HANDLES.map(({ handle, label, className }) => (
            <button
              key={handle}
              type="button"
              aria-label={label}
              className={`absolute size-4 rounded-full border-2 border-background bg-primary shadow-sm ${className}`}
              onPointerDown={(event) => startDrag(event, handle)}
            />
          ))}
          <span className="pointer-events-none absolute -top-8 left-0 rounded bg-background/90 px-2 py-1 text-xs text-foreground shadow">
            Drag to reposition. Drag corners to crop.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function containBounds(container: Bounds, aspectRatio: number): Bounds {
  if (container.width <= 0 || container.height <= 0) return { width: 0, height: 0 };
  if (container.width / container.height > aspectRatio) {
    return { width: container.height * aspectRatio, height: container.height };
  }
  return { width: container.width, height: container.width / aspectRatio };
}
