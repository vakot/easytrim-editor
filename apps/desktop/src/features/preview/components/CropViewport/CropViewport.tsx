import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type PointerEvent, useCallback, useEffect, useMemo, useRef } from "react";

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
import { isQuarterTurn } from "@/domain/rotation";
import { usePreviewTransform } from "@/features/preview";

import type { CropHandle } from "../../lib/crop-geometry.utils";
import { previewGeometryFor, sourceCropForRotation } from "../../lib/preview-geometry";
import { previewFrameAspectFor } from "../../lib/preview-presentation";
import { previewTransitionFor } from "../../lib/preview-transition";

import { CropSelection } from "./components/CropSelection";
import { CropSnapMarkers } from "./components/CropSnapMarkers";
import { CropViewportContextMenu } from "./components/CropViewportContextMenu";
import { CropViewportTooltip } from "./components/CropViewportTooltip";
import { CropViewportVideo } from "./components/CropViewportVideo";
import { PreviewFrame } from "./components/PreviewFrame";
import { useCropSelection } from "./hooks/useCropSelection";
import { usePreviewPresentation } from "./hooks/usePreviewPresentation";

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
  const reduceMotion = useReducedMotion() === true;
  const previewRef = useRef<HTMLDivElement>(null);
  const sourceFrameRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const cropSelection = useCropSelection(previewRef, sourceFrameRef, rotationDegrees);
  const sourceWidth = sourceMedia?.video.width ?? 0;
  const sourceHeight = sourceMedia?.video.height ?? 0;
  const presentationInput = useMemo(
    () => ({
      crop,
      cropIsOpen: cropSelection.isOpen,
      flipHorizontal,
      flipVertical,
      rotation: rotationDegrees,
    }),
    [crop, cropSelection.isOpen, flipHorizontal, flipVertical, rotationDegrees],
  );

  const { finishTransition, presentation } = usePreviewPresentation(
    presentationInput,
    sourceWidth,
    sourceHeight,
    cropSelection.isDragging,
    reduceMotion,
    previewRef,
    frameRef,
  );

  useEffect(() => {
    onCropToolOpenChange?.(cropSelection.isOpen);
  }, [cropSelection.isOpen, onCropToolOpenChange]);

  useEffect(() => {
    if (cropSelection.isOpen) videoRef.current?.pause();
  }, [cropSelection.isOpen, videoRef]);

  const { clearDrag, isDragging, isEditing, open, startDrag } = cropSelection;
  const resolved = presentation.status === "transitioning" ? presentation.to : presentation.state;
  const geometry = previewGeometryFor(sourceWidth, sourceHeight, resolved.crop, resolved.rotation);
  const cropIsOpen = resolved.cropIsOpen;
  const transformTransition = previewTransitionFor(isDragging || reduceMotion, reduceMotion);
  const selectionFadeTransition = previewTransitionFor(false, reduceMotion);
  const startCropDrag = useCallback(
    (event: PointerEvent<HTMLElement>, handle: CropHandle) => {
      if (presentation.status === "transitioning") {
        finishTransition(presentation.id);
        startDrag(event, handle, presentation.toFrame);
        return;
      }
      startDrag(event, handle);
    },
    [finishTransition, presentation, startDrag],
  );

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

  const previewAspect = previewFrameAspectFor(geometry, cropIsOpen);
  const sourceCrop = cropIsOpen
    ? { x: 0, y: 0, width: 1, height: 1 }
    : sourceCropForRotation(resolved.crop, resolved.rotation);

  const sourceGeometry = {
    width: `${100 / sourceCrop.width}%`,
    height: `${100 / sourceCrop.height}%`,
    left: `${(-sourceCrop.x / sourceCrop.width) * 100}%`,
    top: `${(-sourceCrop.y / sourceCrop.height) * 100}%`,
  };

  const quarterTurn = isQuarterTurn(resolved.rotation);
  const rotationLayerGeometry = quarterTurn
    ? {
        width: `${(100 / previewAspect).toString()}%`,
        height: `${(previewAspect * 100).toString()}%`,
      }
    : { width: "100%", height: "100%" };

  return (
    <CropViewportContextMenu>
      <CropViewportTooltip containerRef={previewRef} cropSelection={cropSelection}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-opacity duration-(--preview-transition-duration) ease-in-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none layout-default:rounded-md"
          data-crop-preview-affordance
          style={{ opacity: cropIsOpen ? 0 : undefined }}
        />
        <PreviewFrame
          aspectRatio={previewAspect}
          cropEditing={cropIsOpen}
          frameRef={frameRef}
          onTransitionComplete={finishTransition}
          presentation={presentation}
          transition={transformTransition}
        >
          <motion.div
            animate={{
              scaleX: cropIsOpen || !resolved.flipHorizontal ? 1 : -1,
              scaleY: cropIsOpen || !resolved.flipVertical ? 1 : -1,
            }}
            className="absolute inset-0"
            data-flip-horizontal={cropIsOpen ? false : resolved.flipHorizontal}
            data-flip-layer
            data-flip-vertical={cropIsOpen ? false : resolved.flipVertical}
            initial={false}
            style={{ transformOrigin: "50% 50%" }}
            transition={transformTransition}
          >
            <motion.div
              animate={{
                ...rotationLayerGeometry,
                rotate: resolved.rotationAngle,
              }}
              className="absolute top-1/2 left-1/2"
              data-output-rotation={resolved.rotationAngle}
              data-rotating-output
              initial={false}
              style={{ x: "-50%", y: "-50%", transformOrigin: "50% 50%" }}
              transition={transformTransition}
            >
              <div
                className="absolute inset-0 overflow-hidden"
                data-crop-clip
                data-crop-mask
                data-full-rotated-source
                data-source-geometry={cropIsOpen ? "full-rotated-source" : "crop-relative-source"}
              >
                <CropViewportVideo
                  cropIsOpen={cropIsOpen}
                  presentationRotation={resolved.rotationAngle}
                  style={sourceGeometry}
                  transition={transformTransition}
                />
              </div>
            </motion.div>
          </motion.div>
          <div
            className="absolute inset-0"
            data-crop-selection-coordinate-space
            ref={sourceFrameRef}
          >
            <AnimatePresence initial={false}>
              {cropIsOpen ? (
                <CropSelection
                  crop={resolved.crop}
                  fadeTransition={selectionFadeTransition}
                  isDragging={isDragging}
                  key="crop-selection"
                  onPointerDown={startCropDrag}
                  selectionRef={cropSelection.selectionRef}
                />
              ) : null}
            </AnimatePresence>
          </div>
          <CropSnapMarkers transition={transformTransition} visible={cropIsOpen && isEditing} />
        </PreviewFrame>
      </CropViewportTooltip>
    </CropViewportContextMenu>
  );
}

export { CropViewport };
