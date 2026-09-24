import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  cropReset,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { usePreviewTransform } from "@/features/preview";

import { CropSelection } from "./components/CropSelection";
import { CropSnapMarkers } from "./components/CropSnapMarkers";
import { CropViewportContextMenu } from "./components/CropViewportContextMenu";
import { CropViewportTooltip } from "./components/CropViewportTooltip";
import { CropViewportVideo } from "./components/CropViewportVideo";
import { useCropViewport } from "./hooks/useCropViewport";

function CropViewport() {
  const viewport = useCropViewport();
  const dispatch = useAppDispatch();
  const { registerHandlers } = usePreviewTransform();
  const flipHorizontal = useAppSelector(selectFlipHorizontal);
  const flipVertical = useAppSelector(selectFlipVertical);
  const rotationDegrees = useAppSelector(selectRotationDegrees);
  const previewRotationRef = useRef<number>(rotationDegrees);
  const [previewRotationDegrees, setPreviewRotationDegrees] = useState<number>(rotationDegrees);

  useEffect(() => {
    const previousRotation = normalizeRotation(previewRotationRef.current);
    if (previousRotation === rotationDegrees) return;
    const clockwiseDelta = (rotationDegrees - previousRotation + 360) % 360;
    const delta = clockwiseDelta === 270 ? -90 : clockwiseDelta;
    const nextPreviewRotation = previewRotationRef.current + delta;
    previewRotationRef.current = nextPreviewRotation;
    setPreviewRotationDegrees(nextPreviewRotation);
  }, [rotationDegrees]);

  const {
    containerRef,
    cropSelection,
    onSourceMetadata,
    selectionFrame,
    sourceFrame,
    transformOrigin,
    viewport: viewportBounds,
    viewportFrame,
    viewportTransition,
  } = viewport;

  const openCrop = useCallback(
    () => cropSelection.open(viewportFrame),
    [cropSelection, viewportFrame],
  );

  const resetTransform = useCallback(() => {
    cropSelection.clearDrag();
    dispatch(cropReset());
    dispatch(commitActiveEditingInstanceDraft());
  }, [cropSelection, dispatch]);

  const transformHandlers = useMemo(
    () => ({ openCrop, resetTransform }),
    [openCrop, resetTransform],
  );

  useEffect(() => registerHandlers(transformHandlers), [registerHandlers, transformHandlers]);

  if (!viewport.isPreviewReady) return null;

  const previewTransform = [
    viewport.sourceRenderScale < 1 ? `scale(${1 / viewport.sourceRenderScale})` : null,
    `rotate(${previewRotationDegrees}deg)`,
    flipHorizontal ? "scaleX(-1)" : null,
    flipVertical ? "scaleY(-1)" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <CropViewportContextMenu>
      <CropViewportTooltip
        containerRef={containerRef}
        cropSelection={cropSelection}
        viewport={viewportBounds}
      >
        {!cropSelection.isOpen ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none layout-default:rounded-md"
            data-crop-preview-affordance
          />
        ) : null}
        <div
          className={`absolute overflow-hidden layout-default:rounded-md ${viewportTransition}`}
          style={{
            width: viewportBounds.width,
            height: viewportBounds.height,
            left: viewportFrame.left,
            top: viewportFrame.top,
          }}
        >
          <CropViewportVideo
            cropIsOpen={cropSelection.isOpen}
            onSourceMetadata={onSourceMetadata}
            previewTransform={previewTransform}
            sourceFrame={sourceFrame}
            transformOrigin={transformOrigin}
            viewportTransition={viewportTransition}
          />
        </div>
        <CropSnapMarkers frame={viewportFrame} visible={cropSelection.isEditing} />
        {cropSelection.isEditing ? (
          <CropSelection
            enterFrom={cropSelection.enterFrom}
            frame={selectionFrame}
            isDragging={cropSelection.isDragging}
            onPointerDown={cropSelection.startDrag}
            selectionRef={cropSelection.selectionRef}
          />
        ) : null}
      </CropViewportTooltip>
    </CropViewportContextMenu>
  );
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

export { CropViewport };
