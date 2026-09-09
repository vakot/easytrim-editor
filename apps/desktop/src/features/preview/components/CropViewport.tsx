import { RotateCcw, RotateCw } from "lucide-react";
import {
  type FocusEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CursorTooltip } from "@/components/ui/cursor-tooltip";

import { isQuarterTurn } from "@/domain/rotation";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import { useCropSelection } from "../hooks/useCropSelection";
import {
  type Bounds,
  centerFrame,
  cropFrame,
  scaleFrameToSourceBounds,
} from "../lib/crop-frame.utils";
import { isFullCrop } from "../lib/crop-geometry.utils";

import { CropSelection } from "./CropSelection";
import { CropSnapMarkers } from "./CropSnapMarkers";

// Covers the snap-marker offset, its labels, and a small buffer inside the clipped preview card.
const CROP_TOOL_INSET_PX = 28;

interface CropViewportProps {
  muted: boolean;
  nativeLoopEnabled: boolean;
  onCanPlay: () => void;
  onCropToolOpenChange?: (isOpen: boolean) => void;
  onEnded: () => void;
  onError: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPlay: () => void;
  onTimeUpdate: (seconds: number) => void;
  onTogglePlayback: (origin?: DiagnosticOrigin) => void;
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
  const [sourceDimensions, setSourceDimensions] = useState<Bounds>({ width: 0, height: 0 });
  const [sourceAspectRatio, setSourceAspectRatio] = useState(16 / 9);
  const cropSelection = useCropSelection(containerRef);

  useEffect(() => {
    onCropToolOpenChange?.(cropSelection.isOpen);
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

  useEffect(() => {
    diagnostics.event("media.source.changed", {
      data: { kind: previewKind },
      origin: { type: "internal" },
    });
  }, [previewKind, sourceUrl]);

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
  const cropToolInset = cropSelection.isEditing ? CROP_TOOL_INSET_PX : 0;
  const viewportBounds = {
    width: Math.max(0, containerBounds.width - cropToolInset * 2),
    height: Math.max(0, containerBounds.height - cropToolInset * 2),
  };

  const displayedSourceAspectRatio = isQuarterTurn(cropSelection.rotationDegrees)
    ? 1 / sourceAspectRatio
    : sourceAspectRatio;

  const viewportAspectRatio = cropIsApplied
    ? (displayedSourceAspectRatio * cropSelection.crop.width) / cropSelection.crop.height
    : displayedSourceAspectRatio;

  const viewport = containBounds(viewportBounds, viewportAspectRatio);
  const centeredViewportFrame = centerFrame(viewportBounds, viewport);
  const viewportFrame = {
    ...centeredViewportFrame,
    left: cropToolInset + centeredViewportFrame.left,
    top: cropToolInset + centeredViewportFrame.top,
  };

  const selectionFrame = cropFrame(viewportFrame, cropSelection.crop);
  const displaySourceFrame = cropIsApplied
    ? {
        width: viewport.width / cropSelection.crop.width,
        height: viewport.height / cropSelection.crop.height,
      }
    : { width: viewport.width, height: viewport.height };

  const quarterTurn = isQuarterTurn(cropSelection.rotationDegrees);
  const crop = cropSelection.crop;
  const rawCrop =
    cropSelection.rotationDegrees === 90
      ? { x: 1 - crop.y - crop.height, y: crop.x, width: crop.height, height: crop.width }
      : cropSelection.rotationDegrees === 180
        ? {
            x: 1 - crop.x - crop.width,
            y: 1 - crop.y - crop.height,
            width: crop.width,
            height: crop.height,
          }
        : cropSelection.rotationDegrees === 270
          ? { x: crop.y, y: 1 - crop.x - crop.width, width: crop.height, height: crop.width }
          : crop;

  const rawSourceFrame = quarterTurn
    ? { width: displaySourceFrame.height, height: displaySourceFrame.width }
    : displaySourceFrame;

  const { frame: renderedRawSourceFrame, scale: sourceRenderScale } = scaleFrameToSourceBounds(
    rawSourceFrame,
    sourceDimensions,
  );

  const sourceFrame = {
    width: renderedRawSourceFrame.width,
    height: renderedRawSourceFrame.height,
    left: cropIsApplied
      ? (viewport.width - rawCrop.width * renderedRawSourceFrame.width) / 2 -
        rawCrop.x * renderedRawSourceFrame.width
      : (viewport.width - renderedRawSourceFrame.width) / 2,
    top: cropIsApplied
      ? (viewport.height - rawCrop.height * renderedRawSourceFrame.height) / 2 -
        rawCrop.y * renderedRawSourceFrame.height
      : (viewport.height - renderedRawSourceFrame.height) / 2,
  };

  const transformOrigin = cropIsApplied
    ? `${(rawCrop.x + rawCrop.width / 2) * 100}% ${(rawCrop.y + rawCrop.height / 2) * 100}%`
    : "center center";

  const viewportTransition = !cropSelection.isDragging
    ? "transition-[width,height,left,top,transform] duration-200 ease-out motion-reduce:transition-none"
    : "";

  const previewTransform =
    sourceRenderScale < 1
      ? `scale(${1 / sourceRenderScale}) rotate(${cropSelection.previewRotationDegrees}deg)`
      : `rotate(${cropSelection.previewRotationDegrees}deg)`;

  return (
    <CursorTooltip
      aria-label={t("preview.accessibility.crop.preview")}
      className="group relative size-full overflow-hidden bg-preview-surface focus-visible:outline-none"
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
        if (!cropSelection.isOpen) onTogglePlayback({ type: "button", id: "preview.double-click" });
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
          className="pointer-events-none absolute inset-0 z-10 rounded-b-xl border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
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
          onEnded={() => {
            diagnostics.event("media.playback.ended", {
              data: { kind: previewKind },
              origin: { type: "internal" },
            });
            onEnded();
          }}
          onError={() => {
            diagnostics.error(
              "media.playback.failed",
              {
                code: "media_element_error",
                message: "The preview media element reported an error.",
              },
              { data: { kind: previewKind }, origin: { type: "internal" } },
            );
            onError();
          }}
          onLoadedMetadata={(event) => {
            const { videoHeight, videoWidth } = event.currentTarget;
            if (videoWidth > 0 && videoHeight > 0) {
              setSourceAspectRatio(videoWidth / videoHeight);
              setSourceDimensions({ width: videoWidth, height: videoHeight });
            }
            onLoadedMetadata();
          }}
          onLoadStart={() =>
            diagnostics.event("media.load.started", {
              data: { kind: previewKind },
              origin: { type: "internal" },
            })
          }
          onPause={() => {
            diagnostics.event("media.playback.paused", {
              data: { kind: previewKind },
              origin: { type: "internal" },
            });
            onPause();
          }}
          onPlay={(event) => {
            if (cropSelection.isOpen) {
              event.currentTarget.pause();
              return;
            }
            diagnostics.event("media.playback.started", {
              data: { kind: previewKind },
              origin: { type: "internal" },
            });
            onPlay();
          }}
          onStalled={() =>
            diagnostics.warn("media.playback.stalled", {
              data: { kind: previewKind },
              origin: { type: "internal" },
            })
          }
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
          onWaiting={() =>
            diagnostics.event("media.playback.waiting", {
              data: { kind: previewKind },
              origin: { type: "internal" },
            })
          }
          playsInline
          preload="auto"
          ref={videoRef}
          src={sourceUrl}
          style={{
            ...sourceFrame,
            transform: previewTransform,
            transformOrigin,
          }}
        />
      </div>
      <CropSnapMarkers frame={viewportFrame} visible={cropSelection.isEditing} />
      {cropSelection.isOpen ? (
        <div
          className="absolute inset-y-0 right-0 z-20 flex w-10 flex-col items-center justify-start gap-1 border-l border-foreground/10"
          data-crop-rotation-controls
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            aria-label={t("preview.accessibility.crop.rotateCounterclockwise")}
            onClick={cropSelection.rotateCounterclockwise}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
          <Button
            aria-label={t("preview.accessibility.crop.rotateClockwise")}
            onClick={cropSelection.rotateClockwise}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <RotateCw aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {cropSelection.isEditing ? (
        <>
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
