import { useState, type PointerEvent } from "react";

import {
  FULL_CROP,
  moveCrop,
  resizeCrop,
  type CropHandle,
  type CropRect,
} from "../utils/crop-geometry";

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

export function useCropSelection() {
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [isOpen, setIsOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  function open() {
    setIsOpen(true);
  }

  function startDrag(event: PointerEvent<HTMLElement>, handle: CropHandle) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ handle, crop, startX: event.clientX, startY: event.clientY });
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>, viewport: CropSelectionBounds) {
    if (!drag || viewport.width <= 0 || viewport.height <= 0) return;
    const deltaX = (event.clientX - drag.startX) / viewport.width;
    const deltaY = (event.clientY - drag.startY) / viewport.height;
    setCrop(
      drag.handle === "move"
        ? moveCrop(drag.crop, deltaX, deltaY)
        : resizeCrop(drag.crop, drag.handle, deltaX, deltaY),
    );
  }

  function finishDrag() {
    if (!drag) return;
    setDrag(null);
    setIsOpen(false);
  }

  return {
    crop,
    isEditing: isOpen || drag !== null,
    isOpen,
    open,
    startDrag,
    moveDrag,
    finishDrag,
  };
}
