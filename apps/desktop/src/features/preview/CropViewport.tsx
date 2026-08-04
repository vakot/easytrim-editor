import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";

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

const CROP_HINT_DELAY_MS = 500;

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
  const tooltipTimerRef = useRef<number | null>(null);
  const [containerBounds, setContainerBounds] = useState<Bounds>({ width: 0, height: 0 });
  const [sourceAspectRatio, setSourceAspectRatio] = useState(16 / 9);
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [cropToolOpen, setCropToolOpen] = useState(false);
  const [cropHintVisible, setCropHintVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
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

  useEffect(
    () => () => {
      if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
    },
    [],
  );

  const editing = cropToolOpen || drag !== null;
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
  const viewportTransition =
    drag === null
      ? "transition-[width,height,left,top] duration-200 ease-out motion-reduce:transition-none"
      : "";

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
    setCropToolOpen(false);
  }

  function clearCropHint() {
    if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = null;
    setCropHintVisible(false);
    setTooltipPosition(null);
  }

  function updateCropHintPosition(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({ x: event.clientX - bounds.left + 12, y: event.clientY - bounds.top + 12 });
  }

  function showCropHint(event: PointerEvent<HTMLDivElement>) {
    if (cropToolOpen) return;
    updateCropHintPosition(event);
    setCropHintVisible(false);
    if (tooltipTimerRef.current !== null) window.clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = window.setTimeout(() => {
      tooltipTimerRef.current = null;
      setTooltipPosition((position) => position ?? { x: 12, y: 12 });
      setCropHintVisible(true);
    }, CROP_HINT_DELAY_MS);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    moveDrag(event);
    if (!cropToolOpen) updateCropHintPosition(event);
  }

  return (
    <div
      ref={containerRef}
      className="relative size-full overflow-hidden bg-preview-surface"
      onClick={() => {
        if (cropToolOpen) return;
        clearCropHint();
        setCropToolOpen(true);
      }}
      onDoubleClick={onTogglePlayback}
      onPointerEnter={showCropHint}
      onPointerLeave={clearCropHint}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
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

      {editing ? (
        <div
          className="absolute border-2 border-primary bg-primary/10"
          style={{
            width: viewport.width * crop.width,
            height: viewport.height * crop.height,
            left: `calc(50% - ${viewport.width / 2}px + ${viewport.width * crop.x}px)`,
            top: `calc(50% - ${viewport.height / 2}px + ${viewport.height * crop.y}px)`,
          }}
          onClick={(event) => event.stopPropagation()}
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
      {cropHintVisible && tooltipPosition && !cropToolOpen ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded bg-foreground px-2 py-1 text-xs text-background shadow"
          style={{ left: tooltipPosition.x, top: tooltipPosition.y }}
        >
          Click preview to crop
        </span>
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
