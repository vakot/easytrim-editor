import { useCallback, useEffect, useMemo, useRef } from "react";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  cropReset,
  selectCrop,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { usePreviewTransform } from "@/features/preview";

import { previewGeometryFor } from "../../lib/preview-geometry";

import { CropSelection } from "./components/CropSelection";
import { CropSnapMarkers } from "./components/CropSnapMarkers";
import { CropViewportContextMenu } from "./components/CropViewportContextMenu";
import { CropViewportTooltip } from "./components/CropViewportTooltip";
import { CropViewportVideo } from "./components/CropViewportVideo";
import { PreviewFrame } from "./components/PreviewFrame";
import { useCropSelection } from "./hooks/useCropSelection";

function CropViewport() {
  const dispatch = useAppDispatch();
  const { onCropToolOpenChange, videoRef } = usePlayback();
  const { registerHandlers } = usePreviewTransform();
  const crop = useAppSelector(selectCrop);
  const flipHorizontal = useAppSelector(selectFlipHorizontal);
  const flipVertical = useAppSelector(selectFlipVertical);
  const rotationDegrees = useAppSelector(selectRotationDegrees);
  const sourceMedia = useAppSelector(selectSourceMedia);
  const preview = useAppSelector(selectPreview);
  const previewRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const cropSelection = useCropSelection(previewRef, frameRef, rotationDegrees);
  const geometry = previewGeometryFor(
    sourceMedia?.video.width || 16,
    sourceMedia?.video.height || 9,
    crop,
    rotationDegrees,
  );

  useEffect(() => {
    onCropToolOpenChange?.(cropSelection.isOpen);
  }, [cropSelection.isOpen, onCropToolOpenChange]);

  useEffect(() => {
    if (cropSelection.isOpen) videoRef.current?.pause();
  }, [cropSelection.isOpen, videoRef]);

  const { clearDrag, isDragging, isEditing, isOpen, open, startDrag } = cropSelection;

  const resetTransform = useCallback(() => {
    clearDrag();
    dispatch(cropReset());
    dispatch(commitActiveEditingInstanceDraft());
  }, [clearDrag, dispatch]);

  const transformHandlers = useMemo(
    () => ({ openCrop: open, resetTransform }),
    [open, resetTransform],
  );

  useEffect(() => registerHandlers(transformHandlers), [registerHandlers, transformHandlers]);

  if (preview.status !== "ready" || geometry === null) return null;

  const cropIsOpen = isOpen;
  const sourceVideoStyle = {
    ...geometry.unrotatedVideoSize,
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%) rotate(${rotationDegrees}deg)`,
  };

  return (
    <CropViewportContextMenu>
      <CropViewportTooltip containerRef={previewRef} cropSelection={cropSelection}>
        {!cropIsOpen ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none layout-default:rounded-md"
            data-crop-preview-affordance
          />
        ) : null}
        <PreviewFrame
          aspectRatio={cropIsOpen ? geometry.rotatedAspect : geometry.outputAspect}
          cropEditing={cropIsOpen}
          frameRef={frameRef}
        >
          <div className="absolute inset-0 overflow-hidden" data-crop-clip>
            <div
              className="absolute inset-0"
              data-flip-layer
              style={{
                transform: cropIsOpen
                  ? "none"
                  : `scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
              }}
            >
              <div
                className="absolute"
                data-full-rotated-source
                style={
                  cropIsOpen
                    ? { width: "100%", height: "100%", left: "0%", top: "0%" }
                    : geometry.sourceWithinCrop
                }
              >
                <CropViewportVideo cropIsOpen={cropIsOpen} style={sourceVideoStyle} />
              </div>
            </div>
          </div>
          {cropIsOpen ? (
            <>
              <CropSnapMarkers visible={isEditing} />
              <CropSelection
                crop={crop}
                isDragging={isDragging}
                onPointerDown={startDrag}
                selectionRef={cropSelection.selectionRef}
              />
            </>
          ) : null}
        </PreviewFrame>
      </CropViewportTooltip>
    </CropViewportContextMenu>
  );
}

export { CropViewport };
