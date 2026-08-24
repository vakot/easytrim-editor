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
import { CropSnapMarkers } from "./components/CropSnapMarkers";
import { useCropSelection } from "./hooks/use-crop-selection";
import { centerFrame, cropFrame, type Bounds } from "./utils/crop-frame";
import { isFullCrop } from "./utils/crop-geometry";
import type { CropRect } from "./utils/crop-geometry";

const CROP_TOOL_GUTTER_PX = 16;

interface CropViewportProps {
  sourceUrl: string;
  previewKind: "source" | "proxy";
  sourceLabel: string;
  playbackRate: number;
  nativeLoopEnabled: boolean;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onTogglePlayback: () => void;
  onLoadedMetadata: () => void;
  onCanPlay: () => void;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (seconds: number) => void;
  onEnded: () => void;
  onError: () => void;
  onCropToolOpenChange: (isOpen: boolean) => void;
  onCropChange: (crop: CropRect) => void;
}

export function CropViewport({
  sourceUrl,
  previewKind,
  sourceLabel,
  playbackRate,
  nativeLoopEnabled,
  muted,
  videoRef,
  onTogglePlayback,
  onLoadedMetadata,
  onCanPlay,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onError,
  onCropToolOpenChange,
  onCropChange,
}: CropViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState<Bounds>({ width: 0, height: 0 });
  const [sourceAspectRatio, setSourceAspectRatio] = useState(16 / 9);
  const cropSelection = useCropSelection(containerRef, onCropChange);

  useEffect(() => {
    onCropToolOpenChange(cropSelection.isOpen);
  }, [cropSelection.isOpen, onCropToolOpenChange]);

  useEffect(() => {
    if (cropSelection.isOpen) videoRef.current?.pause();
  }, [cropSelection.isOpen, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) onCanPlay();
  }, [onCanPlay, sourceUrl, videoRef]);

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
  const cropToolGutter = cropSelection.isEditing ? CROP_TOOL_GUTTER_PX : 0;
  const viewportBounds = {
    width: Math.max(0, containerBounds.width - cropToolGutter),
    height: Math.max(0, containerBounds.height - cropToolGutter),
  };
  const viewportAspectRatio = cropIsApplied
    ? (sourceAspectRatio * cropSelection.crop.width) / cropSelection.crop.height
    : sourceAspectRatio;
  const viewport = containBounds(viewportBounds, viewportAspectRatio);
  const viewportFrame = {
    ...centerFrame(viewportBounds, viewport),
    left: cropToolGutter + (viewportBounds.width - viewport.width) / 2,
    top: cropToolGutter + (viewportBounds.height - viewport.height) / 2,
  };
  const selectionFrame = cropFrame(viewportFrame, cropSelection.crop);
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
      className={`group relative size-full bg-preview-surface focus-visible:outline-none ${
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
        cropSelection.open(viewportFrame);
      }}
      onDoubleClick={() => {
        if (!cropSelection.isOpen) onTogglePlayback();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " "))
          return;
        event.preventDefault();
        if (cropSelection.isOpen) {
          cropSelection.close();
          return;
        }
        cropSelection.open(viewportFrame);
      }}
      onPointerMove={(event) => cropSelection.moveDrag(event, viewport)}
      onPointerUp={cropSelection.finishDrag}
      onPointerCancel={cropSelection.finishDrag}
    >
      {!cropSelection.isOpen ? (
        <div
          aria-hidden="true"
          data-crop-preview-affordance
          className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        />
      ) : null}
      <div
        className={`absolute overflow-hidden ${viewportTransition}`}
        style={{
          width: viewport.width,
          height: viewport.height,
          left: viewportFrame.left,
          top: viewportFrame.top,
        }}
      >
        <video
          ref={videoRef}
          key={sourceUrl}
          data-playback-rate={playbackRate}
          className={`absolute max-w-none cursor-pointer ${viewportTransition}`}
          style={sourceFrame}
          crossOrigin="anonymous"
          src={sourceUrl}
          preload="auto"
          muted={muted}
          loop={nativeLoopEnabled}
          playsInline
          aria-label={sourceLabel}
          data-preview-kind={previewKind}
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget;
            if (videoWidth > 0 && videoHeight > 0) setSourceAspectRatio(videoWidth / videoHeight);
            onLoadedMetadata();
          }}
          onCanPlay={onCanPlay}
          onPlay={(event) => {
            if (cropSelection.isOpen) {
              event.currentTarget.pause();
              return;
            }
            onPlay();
          }}
          onPause={onPause}
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
          onEnded={onEnded}
          onError={onError}
        />
      </div>
      {cropSelection.isEditing ? (
        <>
          <CropSnapMarkers frame={viewportFrame} />
          <CropSelection
            frame={selectionFrame}
            enterFrom={cropSelection.enterFrom}
            isDragging={cropSelection.isDragging}
            selectionRef={cropSelection.selectionRef}
            onPointerDown={cropSelection.startDrag}
          />
        </>
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
