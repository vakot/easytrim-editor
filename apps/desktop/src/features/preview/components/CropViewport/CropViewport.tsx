import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
import {
  cropSelectionFadeTransitionFor,
  previewTransformTransitionFor,
} from "../../lib/preview-transition";

import { CropSelection } from "./components/CropSelection";
import { CropSnapMarkers } from "./components/CropSnapMarkers";
import { CropViewportContextMenu } from "./components/CropViewportContextMenu";
import { CropViewportTooltip } from "./components/CropViewportTooltip";
import { CropViewportVideo } from "./components/CropViewportVideo";
import { PreviewFrame } from "./components/PreviewFrame";
import { useContinuousRotation } from "./hooks/useContinuousRotation";
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
  const reduceMotion = useReducedMotion() === true;
  const previewRef = useRef<HTMLDivElement>(null);
  const sourceFrameRef = useRef<HTMLDivElement>(null);
  const cropSelection = useCropSelection(previewRef, sourceFrameRef, rotationDegrees);
  const geometry = previewGeometryFor(
    sourceMedia?.video.width ?? 0,
    sourceMedia?.video.height ?? 0,
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
  const presentationRotation = useContinuousRotation(rotationDegrees, reduceMotion);
  const transformTransition = previewTransformTransitionFor(isDragging, reduceMotion);
  const selectionFadeTransition = cropSelectionFadeTransitionFor(reduceMotion);

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
  };

  const sourceGeometry = cropIsOpen
    ? { width: "100%", height: "100%", left: "0%", top: "0%" }
    : geometry.sourceWithinCrop;

  return (
    <CropViewportContextMenu>
      <CropViewportTooltip containerRef={previewRef} cropSelection={cropSelection}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-opacity duration-200 ease-in-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none layout-default:rounded-md"
          data-crop-preview-affordance
          style={{ opacity: cropIsOpen ? 0 : undefined }}
        />
        <PreviewFrame
          aspectRatio={cropIsOpen ? geometry.rotatedAspect : geometry.outputAspect}
          cropEditing={cropIsOpen}
          transition={transformTransition}
        >
          <div className="absolute inset-0 overflow-hidden" data-crop-clip>
            <motion.div
              animate={sourceGeometry}
              className="absolute"
              data-full-rotated-source
              data-source-geometry={cropIsOpen ? "full-rotated-source" : "crop-relative-source"}
              initial={false}
              ref={sourceFrameRef}
              transition={transformTransition}
            >
              <motion.div
                animate={{
                  rotateY: cropIsOpen || !flipHorizontal ? 0 : 180,
                  rotateX: cropIsOpen || !flipVertical ? 0 : 180,
                }}
                className="absolute inset-0"
                data-flip-horizontal={cropIsOpen ? false : flipHorizontal}
                data-flip-layer
                data-flip-vertical={cropIsOpen ? false : flipVertical}
                initial={false}
                style={{ transformOrigin: "50% 50%" }}
                transition={transformTransition}
              >
                <CropViewportVideo
                  cropIsOpen={cropIsOpen}
                  presentationRotation={presentationRotation}
                  style={sourceVideoStyle}
                  transition={transformTransition}
                />
              </motion.div>
              {/* The normalized selection stays in source space so it tracks the crop as the frame opens. */}
              <AnimatePresence initial={false}>
                {cropIsOpen ? (
                  <CropSelection
                    crop={crop}
                    fadeTransition={selectionFadeTransition}
                    geometryTransition={transformTransition}
                    isDragging={isDragging}
                    key="crop-selection"
                    onPointerDown={startDrag}
                    selectionRef={cropSelection.selectionRef}
                  />
                ) : null}
              </AnimatePresence>
            </motion.div>
          </div>
          <CropSnapMarkers visible={cropIsOpen && isEditing} />
        </PreviewFrame>
      </CropViewportTooltip>
    </CropViewportContextMenu>
  );
}

export { CropViewport };
