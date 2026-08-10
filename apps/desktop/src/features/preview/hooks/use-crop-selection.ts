import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import {
  FULL_CROP,
  moveCrop,
  resizeCrop,
  type CropHandle,
  type CropRect,
} from "../utils/crop-geometry";
import type { CropFrame } from "../utils/crop-frame";
import { snapCropToGuides } from "../utils/crop-snapping";

const SNAP_REACH_PX = 12;

interface DragState {
  handle: CropHandle;
  crop: CropRect;
  startX: number;
  startY: number;
}

interface CropSelectionBounds {
  width: number;
  height: number;
}

export function useCropSelection(
  previewRef: RefObject<HTMLDivElement | null>,
  onCropChange?: (crop: CropRect) => void,
) {
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [isOpen, setIsOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [enterFrom, setEnterFrom] = useState<CropFrame | null>(null);
  const selectionRef = useRef<HTMLDivElement>(null);

  function open(frame: CropFrame) {
    setEnterFrom(frame);
    setIsOpen(true);
  }

  function close() {
    setDrag(null);
    setIsOpen(false);
    setEnterFrom(null);
  }

  useEffect(() => {
    onCropChange?.(crop);
  }, [crop, onCropChange]);

  useEffect(() => {
    if (!isOpen || !enterFrom) return;

    // Opening the tool also changes the viewport bounds to make room for its
    // scale. Keep the selection at its previous frame for one committed paint,
    // then release it to the crop frame calculated from those new bounds.
    let releaseFrameId: number | undefined;
    const layoutFrameId = window.requestAnimationFrame(() => {
      releaseFrameId = window.requestAnimationFrame(() => setEnterFrom(null));
    });

    return () => {
      window.cancelAnimationFrame(layoutFrameId);
      if (releaseFrameId !== undefined) window.cancelAnimationFrame(releaseFrameId);
    };
  }, [enterFrom, isOpen]);

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
  }, [isOpen, previewRef]);

  function startDrag(event: ReactPointerEvent<HTMLElement>, handle: CropHandle) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ handle, crop, startX: event.clientX, startY: event.clientY });
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>, viewport: CropSelectionBounds) {
    if (!drag || viewport.width <= 0 || viewport.height <= 0) return;
    const deltaX = (event.clientX - drag.startX) / viewport.width;
    const deltaY = (event.clientY - drag.startY) / viewport.height;
    const nextCrop =
      drag.handle === "move"
        ? moveCrop(drag.crop, deltaX, deltaY)
        : resizeCrop(drag.crop, drag.handle, deltaX, deltaY);
    setCrop(
      event.shiftKey
        ? snapCropToGuides(nextCrop, drag.handle, {
            x: SNAP_REACH_PX / viewport.width,
            y: SNAP_REACH_PX / viewport.height,
          })
        : nextCrop,
    );
  }

  function finishDrag() {
    if (!drag) return;
    setDrag(null);
  }

  return {
    crop,
    isEditing: isOpen || drag !== null,
    isDragging: drag !== null,
    isOpen,
    enterFrom,
    selectionRef,
    open,
    close,
    startDrag,
    moveDrag,
    finishDrag,
  };
}
