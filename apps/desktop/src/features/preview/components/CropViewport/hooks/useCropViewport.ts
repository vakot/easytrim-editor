import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectRotationDegrees } from "@/app/store/slices/crop-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { isQuarterTurn } from "@/domain/rotation";

import {
  type Bounds,
  centerFrame,
  cropFrame,
  scaleFrameToSourceBounds,
} from "../../../lib/crop-frame.utils";
import { isFullCrop } from "../../../lib/crop-geometry.utils";

import { useCropSelection } from "./useCropSelection";

const CROP_TOOL_INSET_PX = 28;

function useCropViewport() {
  const { onCropToolOpenChange, videoRef } = usePlayback();
  const preview = useAppSelector(selectPreview);
  const rotationDegrees = useAppSelector(selectRotationDegrees);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState<Bounds>({ width: 0, height: 0 });
  const [sourceDimensions, setSourceDimensions] = useState<Bounds>({ width: 0, height: 0 });
  const [sourceAspectRatio, setSourceAspectRatio] = useState(16 / 9);
  const cropSelection = useCropSelection(containerRef, rotationDegrees);
  const { isOpen } = cropSelection;

  useEffect(() => {
    onCropToolOpenChange?.(isOpen);
  }, [isOpen, onCropToolOpenChange]);

  useEffect(() => {
    if (isOpen) videoRef.current?.pause();
  }, [isOpen, videoRef]);

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

  const displayedSourceAspectRatio = isQuarterTurn(rotationDegrees)
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

  const quarterTurn = isQuarterTurn(rotationDegrees);
  const crop = cropSelection.crop;
  const rawCrop =
    rotationDegrees === 90
      ? { x: 1 - crop.y - crop.height, y: crop.x, width: crop.height, height: crop.width }
      : rotationDegrees === 180
        ? {
            x: 1 - crop.x - crop.width,
            y: 1 - crop.y - crop.height,
            width: crop.width,
            height: crop.height,
          }
        : rotationDegrees === 270
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

  const onSourceMetadata = useCallback((width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    setSourceAspectRatio(width / height);
    setSourceDimensions({ width, height });
  }, []);

  return {
    containerRef,
    cropSelection,
    isPreviewReady: preview.status === "ready",
    onSourceMetadata,
    selectionFrame,
    sourceRenderScale,
    sourceFrame,
    transformOrigin,
    viewport,
    viewportFrame,
    viewportTransition,
  };
}

function containBounds(container: Bounds, aspectRatio: number): Bounds {
  if (container.width <= 0 || container.height <= 0) return { width: 0, height: 0 };
  if (container.width / container.height > aspectRatio)
    return { width: container.height * aspectRatio, height: container.height };
  return { width: container.width, height: container.width / aspectRatio };
}

export { useCropViewport };
