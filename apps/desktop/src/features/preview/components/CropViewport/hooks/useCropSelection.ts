import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { cropChanged, cropResolutionFor, selectCrop } from "@/app/store/slices/crop-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { FULL_CROP } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import {
  type CropAspectRatioPreset,
  fitCropToAspectRatio,
  resizeCropToAspectRatio,
} from "../../../lib/crop-aspect-ratio.utils";
import {
  type CropHandle,
  type CropRect,
  moveCrop,
  resizeCrop,
} from "../../../lib/crop-geometry.utils";
import { snapCropToGuides, snapResizeCropToGuides } from "../../../lib/crop-snapping.utils";

const SNAP_REACH_PX = 12;

interface DragState {
  crop: CropRect;
  flipHorizontal: boolean;
  flipVertical: boolean;
  handle: CropHandle;
  sourceHeight: number;
  sourceWidth: number;
  startX: number;
  startY: number;
}

interface SourceFrameBounds {
  height: number;
  width: number;
}

function useCropSelection(
  previewRef: RefObject<HTMLDivElement | null>,
  sourceFrameRef: RefObject<HTMLDivElement | null>,
  rotationDegrees: RotationDegrees,
  flipHorizontal: boolean,
  flipVertical: boolean,
) {
  const dispatch = useAppDispatch();
  const sourceMedia = useAppSelector(selectSourceMedia);
  const crop = useAppSelector(selectCrop);
  const [isOpen, setIsOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [aspectRatioPreset, setAspectRatioPreset] = useState<CropAspectRatioPreset>("freeform");

  const selectAspectRatioPreset = useCallback(
    (preset: CropAspectRatioPreset) => {
      setAspectRatioPreset(preset);
      if (preset === "freeform" || !sourceMedia) return;

      const ratio = aspectRatioForPreset(preset);
      if (ratio === null) return;
      const rotatedSourceAspect =
        rotationDegrees === 90 || rotationDegrees === 270
          ? sourceMedia.video.height / sourceMedia.video.width
          : sourceMedia.video.width / sourceMedia.video.height;

      const nextCrop = fitCropToAspectRatio(crop, ratio / rotatedSourceAspect);
      dispatch(
        cropChanged({
          crop: nextCrop,
          resolution: cropResolutionFor(sourceMedia.video ?? null, nextCrop, rotationDegrees),
        }),
      );
      dispatch(commitActiveEditingInstanceDraft());
    },
    [crop, dispatch, rotationDegrees, sourceMedia],
  );

  const resetCropToDefault = useCallback(() => {
    setAspectRatioPreset("freeform");
    if (!sourceMedia) return;

    dispatch(
      cropChanged({
        crop: FULL_CROP,
        resolution: cropResolutionFor(sourceMedia.video ?? null, FULL_CROP, rotationDegrees),
      }),
    );
    dispatch(commitActiveEditingInstanceDraft());
  }, [dispatch, rotationDegrees, sourceMedia]);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    dispatch(commitActiveEditingInstanceDraft());
    setDrag(null);
    setIsOpen(false);
  }, [dispatch]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointerDown(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && previewRef.current?.contains(event.target)) return;
      close();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [close, isOpen, previewRef]);

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    handle: CropHandle,
    sourceFrameBounds?: SourceFrameBounds,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const sourceFrame = sourceFrameRef.current?.getBoundingClientRect();
    const sourceWidth = sourceFrameBounds?.width ?? sourceFrame?.width ?? 0;
    const sourceHeight = sourceFrameBounds?.height ?? sourceFrame?.height ?? 0;
    if (sourceWidth <= 0 || sourceHeight <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      crop,
      flipHorizontal,
      flipVertical,
      sourceHeight,
      sourceWidth,
      handle,
      startX: event.clientX,
      startY: event.clientY,
    });
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const deltaX =
      ((event.clientX - drag.startX) / drag.sourceWidth) * (drag.flipHorizontal ? -1 : 1);

    const deltaY =
      ((event.clientY - drag.startY) / drag.sourceHeight) * (drag.flipVertical ? -1 : 1);

    const presetRatio = aspectRatioForPreset(aspectRatioPreset);
    const ratio =
      presetRatio === null || !sourceMedia
        ? null
        : presetRatio /
          (rotationDegrees === 90 || rotationDegrees === 270
            ? sourceMedia.video.height / sourceMedia.video.width
            : sourceMedia.video.width / sourceMedia.video.height);

    const movedCrop =
      drag.handle === "move"
        ? moveCrop(drag.crop, deltaX, deltaY)
        : ratio === null
          ? resizeCrop(drag.crop, drag.handle, deltaX, deltaY)
          : resizeCropToAspectRatio(drag.crop, drag.handle, deltaX, deltaY, ratio);

    const snapThresholds = {
      x: SNAP_REACH_PX / drag.sourceWidth,
      y: SNAP_REACH_PX / drag.sourceHeight,
    };

    const snappedCrop = event.shiftKey
      ? ratio === null || drag.handle === "move"
        ? snapCropToGuides(movedCrop, drag.handle, snapThresholds)
        : snapResizeCropToGuides(movedCrop, drag.crop, drag.handle, snapThresholds, ratio)
      : movedCrop;

    if (sourceMedia) {
      dispatch(
        cropChanged({
          crop: snappedCrop,
          resolution: cropResolutionFor(sourceMedia.video ?? null, snappedCrop, rotationDegrees),
        }),
      );
    }
  }

  function finishDrag() {
    if (!drag) return;
    dispatch(commitActiveEditingInstanceDraft());
    setDrag(null);
  }

  const clearDrag = useCallback(() => {
    setDrag(null);
  }, []);

  return {
    clearDrag,
    close,
    crop,
    finishDrag,
    isDragging: drag !== null,
    isEditing: isOpen || drag !== null,
    isOpen,
    moveDrag,
    open,
    aspectRatioPreset,
    resetCropToDefault,
    selectAspectRatioPreset,
    startDrag,
  };
}

function aspectRatioForPreset(preset: CropAspectRatioPreset): number | null {
  switch (preset) {
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "4:5":
      return 4 / 5;
    case "freeform":
      return null;
  }
}

export { useCropSelection };
