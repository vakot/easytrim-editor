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
import { selectSourceLoadToken, selectSourceMedia } from "@/app/store/slices/source-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { isQuarterTurn } from "@/domain/rotation";
import { usePreviewTransform } from "@/features/preview";

import type { CropHandle } from "../../lib/crop-geometry.utils";
import { previewGeometryFor, sourceCropForRotation } from "../../lib/preview-geometry";
import {
  previewOutputAspectFor,
  previewOutputBoundsFor,
  previewOutputCoordinateAspectFor,
  previewOutputWidthTargetFor,
} from "../../lib/preview-presentation";
import { previewTransitionFor } from "../../lib/preview-transition";

import { CropSelection } from "./components/CropSelection";
import { CropSnapMarkers } from "./components/CropSnapMarkers";
import { CropViewportContextMenu } from "./components/CropViewportContextMenu";
import { CropViewportTooltip } from "./components/CropViewportTooltip";
import { CropViewportVideo } from "./components/CropViewportVideo";
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
  const sourceLoadToken = useAppSelector(selectSourceLoadToken);
  const preview = useAppSelector(selectPreview);
  const reduceMotion = useReducedMotion() === true;
  const previewRef = useRef<HTMLDivElement>(null);
  const sourceFrameRef = useRef<HTMLDivElement>(null);
  const cropSelection = useCropSelection(
    previewRef,
    sourceFrameRef,
    rotationDegrees,
    flipHorizontal,
    flipVertical,
  );

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

  const presentation = usePreviewPresentation(presentationInput, sourceLoadToken, reduceMotion);

  useEffect(() => {
    onCropToolOpenChange?.(cropSelection.isOpen);
  }, [cropSelection.isOpen, onCropToolOpenChange]);

  useEffect(() => {
    if (cropSelection.isOpen) videoRef.current?.pause();
  }, [cropSelection.isOpen, videoRef]);

  const { clearDrag, isDragging, isEditing, open, startDrag } = cropSelection;
  const resolved = presentation;
  const geometry = previewGeometryFor(sourceWidth, sourceHeight, resolved.crop, resolved.rotation);
  const cropIsOpen = resolved.cropIsOpen;
  const transformTransition = previewTransitionFor(isDragging || reduceMotion, reduceMotion);
  const previewAspect = geometry === null ? 1 : previewOutputAspectFor(geometry, cropIsOpen);
  const quarterTurn = isQuarterTurn(resolved.rotation);
  const outputCoordinateAspect = previewOutputCoordinateAspectFor(previewAspect, quarterTurn);
  const outputWidthTarget = previewOutputWidthTargetFor(previewAspect, cropIsOpen, quarterTurn);
  const cropRulerWidthTarget = previewOutputWidthTargetFor(previewAspect, cropIsOpen, false);
  const startCropDrag = useCallback(
    (event: PointerEvent<HTMLElement>, handle: CropHandle) => {
      const viewportBounds = previewRef.current?.getBoundingClientRect();
      const outputBounds = viewportBounds
        ? previewOutputBoundsFor(
            viewportBounds.width,
            viewportBounds.height,
            previewAspect,
            cropIsOpen,
          )
        : undefined;

      startDrag(event, handle, outputBounds);
    },
    [cropIsOpen, previewAspect, startDrag],
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

  const sourceCrop = cropIsOpen
    ? { x: 0, y: 0, width: 1, height: 1 }
    : sourceCropForRotation(resolved.crop, resolved.rotation);

  const sourceGeometry = {
    width: `${100 / sourceCrop.width}%`,
    height: `${100 / sourceCrop.height}%`,
    left: `${(-sourceCrop.x / sourceCrop.width) * 100}%`,
    top: `${(-sourceCrop.y / sourceCrop.height) * 100}%`,
  };

  return (
    <CropViewportContextMenu>
      <CropViewportTooltip containerRef={previewRef} cropSelection={cropSelection}>
        <div className="@container-size absolute inset-0 overflow-hidden" data-preview-viewport>
          <motion.div
            animate={{ aspectRatio: outputCoordinateAspect, width: outputWidthTarget }}
            className="absolute top-1/2 left-1/2 overflow-visible"
            data-crop-editing={cropIsOpen}
            data-output-aspect-ratio={previewAspect}
            data-output-coordinate-aspect-ratio={outputCoordinateAspect}
            data-output-width-target={outputWidthTarget}
            data-preview-output
            initial={false}
            style={{ x: "-50%", y: "-50%" }}
            transition={transformTransition}
          >
            <motion.div
              animate={{
                scaleX: resolved.flipHorizontal ? -1 : 1,
                scaleY: resolved.flipVertical ? -1 : 1,
              }}
              className="absolute inset-0"
              data-flip-horizontal={resolved.flipHorizontal}
              data-flip-layer
              data-flip-vertical={resolved.flipVertical}
              initial={false}
              style={{ transformOrigin: "50% 50%" }}
              transition={transformTransition}
            >
              <motion.div
                animate={{ rotate: resolved.rotationAngle }}
                className="absolute inset-0"
                data-output-rotation={resolved.rotationAngle}
                data-rotating-output
                initial={false}
                style={{ transformOrigin: "50% 50%" }}
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
                <div
                  className="absolute inset-0"
                  data-crop-selection-coordinate-space
                  ref={sourceFrameRef}
                >
                  <AnimatePresence initial={false}>
                    {cropIsOpen ? (
                      <CropSelection
                        crop={resolved.crop}
                        flipHorizontal={resolved.flipHorizontal}
                        flipVertical={resolved.flipVertical}
                        isDragging={isDragging}
                        key="crop-selection"
                        onPointerDown={startCropDrag}
                        rotation={resolved.rotation}
                        transition={transformTransition}
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
          <CropSnapMarkers
            aspectRatio={previewAspect}
            transition={transformTransition}
            visible={cropIsOpen && isEditing}
            widthTarget={cropRulerWidthTarget}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-opacity duration-(--preview-transition-duration) ease-in-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none layout-default:rounded-md"
            data-crop-preview-affordance
            style={{ opacity: cropIsOpen ? 0 : undefined }}
          />
        </div>
      </CropViewportTooltip>
    </CropViewportContextMenu>
  );
}

export { CropViewport };
