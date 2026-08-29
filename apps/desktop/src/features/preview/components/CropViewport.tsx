import {
  type FocusEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { CursorTooltip } from "@/components/ui/cursor-tooltip";

import { useCropSelection } from "../hooks/useCropSelection";
import { type Bounds, centerFrame, cropFrame } from "../lib/crop-frame.utils";
import { isFullCrop } from "../lib/crop-geometry.utils";

import { CropSelection } from "./CropSelection";
import { CropSnapMarkers } from "./CropSnapMarkers";

const CROP_TOOL_GUTTER_PX = 16;

interface CropViewportProps {
  muted: boolean;
  nativeLoopEnabled: boolean;
  onCanPlay: () => void;
  onCropToolOpenChange: (isOpen: boolean) => void;
  onEnded: () => void;
  onError: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPlay: () => void;
  onTimeUpdate: (seconds: number) => void;
  onTogglePlayback: () => void;
  playbackRate: number;
  previewKind: "source" | "proxy";
  sourceLabel: string;
  sourceUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function CropViewport({
  muted,
  nativeLoopEnabled,
  onCanPlay,
  onCropToolOpenChange,
  onEnded,
  onError,
  onLoadedMetadata,
  onPause,
  onPlay,
  onTimeUpdate,
  onTogglePlayback,
  playbackRate,
  previewKind,
  sourceLabel,
  sourceUrl,
  videoRef,
}: CropViewportProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState<Bounds>({ width: 0, height: 0 });
  const [sourceAspectRatio, setSourceAspectRatio] = useState(16 / 9);
  const cropSelection = useCropSelection(containerRef);

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

  useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, [sourceUrl, videoRef]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateBounds = () => {
      const { height, width } = container.getBoundingClientRect();
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
      aria-label={t("preview.accessibility.crop.preview")}
      className={`group relative size-full bg-preview-surface focus-visible:outline-none ${
        cropSelection.isEditing ? "overflow-visible" : "overflow-hidden"
      }`}
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
      onPointerCancel={cropSelection.finishDrag}
      onPointerMove={(event) => cropSelection.moveDrag(event, viewport)}
      onPointerUp={cropSelection.finishDrag}
      ref={containerRef}
      tabIndex={0}
      tooltipContent={t("preview.tooltips.crop")}
    >
      {!cropSelection.isOpen ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          data-crop-preview-affordance
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
          aria-label={sourceLabel}
          className={`absolute max-w-none cursor-pointer ${viewportTransition}`}
          crossOrigin="anonymous"
          data-playback-rate={playbackRate}
          data-preview-kind={previewKind}
          key={sourceUrl}
          loop={nativeLoopEnabled}
          muted={muted}
          onCanPlay={onCanPlay}
          onEnded={onEnded}
          onError={onError}
          onLoadedMetadata={(event) => {
            const { videoHeight, videoWidth } = event.currentTarget;
            if (videoWidth > 0 && videoHeight > 0) setSourceAspectRatio(videoWidth / videoHeight);
            onLoadedMetadata();
          }}
          onPause={onPause}
          onPlay={(event) => {
            if (cropSelection.isOpen) {
              event.currentTarget.pause();
              return;
            }
            onPlay();
          }}
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
          playsInline
          preload="auto"
          ref={videoRef}
          src={sourceUrl}
          style={sourceFrame}
        />
      </div>
      {cropSelection.isEditing ? (
        <>
          <CropSnapMarkers frame={viewportFrame} />
          <CropSelection
            enterFrom={cropSelection.enterFrom}
            frame={selectionFrame}
            isDragging={cropSelection.isDragging}
            onPointerDown={cropSelection.startDrag}
            selectionRef={cropSelection.selectionRef}
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
