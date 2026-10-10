import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type PointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  cropReset,
  selectCrop,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { nativeDialogStateChanged } from "@/app/store/slices/import-workflow-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import {
  selectSourceLoadToken,
  selectSourceMedia,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { isQuarterTurn } from "@/domain/rotation";
import { usePreviewRuntime, usePreviewTransform } from "@/features/preview";
import { useTimelineTransport } from "@/features/timeline";
import { saveFramePng } from "@/lib/tauri/media";

import { CROP_ASPECT_RATIO_PRESETS } from "../../lib/crop-aspect-ratio.utils";
import type { CropHandle } from "../../lib/crop-geometry.utils";
import { capturePreviewFrame, frameFileNameFor, frameNumberAt } from "../../lib/frame-capture";
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
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isPlaying, resumeAfterInteraction, suspendForInteraction } = useTimelineTransport();

  const { videoRef } = usePreviewRuntime();
  const { registerHandlers } = usePreviewTransform();
  const crop = useAppSelector(selectCrop);
  const flipHorizontal = useAppSelector(selectFlipHorizontal);
  const flipVertical = useAppSelector(selectFlipVertical);
  const rotationDegrees = useAppSelector(selectRotationDegrees);
  const sourceMedia = useAppSelector(selectSourceMedia);
  const sourceSelection = useAppSelector(selectSourceSelection);
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

  const resumeAfterCropRef = useRef(false);
  const cropWasOpenRef = useRef(false);

  useLayoutEffect(() => {
    if (cropSelection.isOpen && !cropWasOpenRef.current) {
      cropWasOpenRef.current = true;
      resumeAfterCropRef.current = suspendForInteraction();
      return;
    }
    if (!cropSelection.isOpen && cropWasOpenRef.current) {
      cropWasOpenRef.current = false;
    } else {
      return;
    }
    resumeAfterInteraction(resumeAfterCropRef.current);
    resumeAfterCropRef.current = false;
  }, [cropSelection.isOpen, resumeAfterInteraction, suspendForInteraction]);

  const {
    aspectRatioPreset,
    clearDrag,
    isDragging,
    isEditing,
    open,
    selectAspectRatioPreset,
    startDrag,
  } = cropSelection;

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

      const rootFontSizePx = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      );

      const outputBounds = viewportBounds
        ? previewOutputBoundsFor(
            viewportBounds.width,
            viewportBounds.height,
            previewAspect,
            cropIsOpen,
            rootFontSizePx,
          )
        : undefined;

      startDrag(event, handle, outputBounds);
    },
    [cropIsOpen, previewAspect, startDrag],
  );

  const resetTransform = useCallback(() => {
    clearDrag();
    selectAspectRatioPreset("freeform");
    dispatch(cropReset());
    dispatch(commitActiveEditingInstanceDraft());
  }, [clearDrag, dispatch, selectAspectRatioPreset]);

  const captureCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) throw new Error("The preview frame is not available.");

    return {
      currentTimeSeconds: video.currentTime,
      frame: capturePreviewFrame(video, crop, rotationDegrees, flipHorizontal, flipVertical),
    };
  }, [crop, flipHorizontal, flipVertical, rotationDegrees, videoRef]);

  const saveFrame = useCallback(async () => {
    if (isPlaying || !videoRef.current?.paused) return;

    try {
      const { currentTimeSeconds, frame } = captureCurrentFrame();
      const blob = await frame;
      const defaultName = frameFileNameFor(
        sourceSelection?.displayName ?? "frame",
        frameNumberAt(
          currentTimeSeconds,
          sourceMedia?.video.averageFrameRate ?? sourceMedia?.video.realFrameRate,
        ),
      );

      const pngData = new Uint8Array(await blob.arrayBuffer());

      dispatch(nativeDialogStateChanged(true));
      let saved: boolean;
      try {
        saved = await saveFramePng(pngData, defaultName);
      } finally {
        dispatch(nativeDialogStateChanged(false));
      }
      if (saved) toast.success(t("preview.frame.saved"));
    } catch {
      toast.error(t("preview.frame.saveFailed"));
    }
  }, [captureCurrentFrame, dispatch, isPlaying, sourceMedia, sourceSelection, t, videoRef]);

  const copyFrame = useCallback(async () => {
    try {
      const { frame } = captureCurrentFrame();
      const blob = await frame;
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw new Error("Image clipboard access is unavailable.");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success(t("preview.frame.copied"));
    } catch {
      toast.error(t("preview.frame.copyFailed"));
    }
  }, [captureCurrentFrame, t]);

  const transformHandlers = useMemo(
    () => ({ copyFrame, openCrop: open, resetTransform, saveFrame }),
    [copyFrame, open, resetTransform, saveFrame],
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
          {cropIsOpen ? (
            <div
              aria-label={t("preview.crop.aspectRatioPresets")}
              className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-xl border border-border/70 bg-background/90 p-1 shadow-lg backdrop-blur-sm"
              data-crop-aspect-ratio-presets
              onClick={(event) => event.stopPropagation()}
              role="group"
            >
              <Button
                aria-pressed={aspectRatioPreset === "freeform"}
                className="h-10 min-w-10 px-2 text-xs"
                onClick={() => selectAspectRatioPreset("freeform")}
                size="sm"
                variant={aspectRatioPreset === "freeform" ? "secondary" : "ghost"}
              >
                {t("preview.crop.freeform")}
              </Button>
              {CROP_ASPECT_RATIO_PRESETS.map(({ label }) => (
                <Button
                  aria-pressed={aspectRatioPreset === label}
                  className="h-10 min-w-10 px-2 text-xs"
                  key={label}
                  onClick={() => selectAspectRatioPreset(label)}
                  size="sm"
                  variant={aspectRatioPreset === label ? "secondary" : "ghost"}
                >
                  {label}
                </Button>
              ))}
            </div>
          ) : null}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-opacity duration-(--preview-transition-duration) ease-in-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            data-crop-preview-affordance
            style={{ opacity: cropIsOpen ? 0 : undefined }}
          />
        </div>
      </CropViewportTooltip>
    </CropViewportContextMenu>
  );
}

export { CropViewport };
