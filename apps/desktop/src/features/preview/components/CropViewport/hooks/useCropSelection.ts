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
  frameHeight: number;
  frameWidth: number;
  handle: CropHandle;
  startX: number;
  startY: number;
}

function useCropSelection(
  previewRef: RefObject<HTMLDivElement | null>,
  cropFrameRef: RefObject<HTMLDivElement | null>,
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

  function startDrag(event: ReactPointerEvent<HTMLElement>, handle: CropHandle) {
    event.preventDefault();
    event.stopPropagation();
    const frame = cropFrameRef.current?.getBoundingClientRect();
    if (!frame || frame.width <= 0 || frame.height <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      crop,
      frameHeight: frame.height,
      frameWidth: frame.width,
      handle,
      startX: event.clientX,
      startY: event.clientY,
    });
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const deltaX = (event.clientX - drag.startX) / drag.frameWidth;
    const deltaY = (event.clientY - drag.startY) / drag.frameHeight;
    const movedCrop =
      drag.handle === "move"
        ? moveCrop(drag.crop, deltaX, deltaY)
        : resizeCrop(drag.crop, drag.handle, deltaX, deltaY);

    const nextCrop = event.shiftKey
      ? snapCropToGuides(movedCrop, drag.handle, {
          x: SNAP_REACH_PX / drag.frameWidth,
          y: SNAP_REACH_PX / drag.frameHeight,
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
