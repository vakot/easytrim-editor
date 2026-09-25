import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { cropChanged, cropResolutionFor, selectCrop } from "@/app/store/slices/crop-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import type { RotationDegrees } from "@/domain/rotation";

import {
  type CropHandle,
  type CropRect,
  moveCrop,
  resizeCrop,
} from "../../../lib/crop-geometry.utils";
import { snapCropToGuides } from "../../../lib/crop-snapping.utils";

const SNAP_REACH_PX = 12;

interface DragState {
  crop: CropRect;
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
) {
  const dispatch = useAppDispatch();
  const sourceMedia = useAppSelector(selectSourceMedia);
  const crop = useAppSelector(selectCrop);
  const [isOpen, setIsOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const selectionRef = useRef<HTMLDivElement>(null);

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
      sourceHeight,
      sourceWidth,
      handle,
      startX: event.clientX,
      startY: event.clientY,
    });
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const deltaX = (event.clientX - drag.startX) / drag.sourceWidth;
    const deltaY = (event.clientY - drag.startY) / drag.sourceHeight;
    const movedCrop =
      drag.handle === "move"
        ? moveCrop(drag.crop, deltaX, deltaY)
        : resizeCrop(drag.crop, drag.handle, deltaX, deltaY);

    const nextCrop = event.shiftKey
      ? snapCropToGuides(movedCrop, drag.handle, {
          x: SNAP_REACH_PX / drag.sourceWidth,
          y: SNAP_REACH_PX / drag.sourceHeight,
        })
      : movedCrop;

    if (sourceMedia) {
      dispatch(
        cropChanged({
          crop: nextCrop,
          resolution: cropResolutionFor(sourceMedia.video ?? null, nextCrop, rotationDegrees),
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
    selectionRef,
    startDrag,
  };
}

export { useCropSelection };
