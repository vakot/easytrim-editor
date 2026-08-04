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

export function useCropSelection(previewRef: RefObject<HTMLDivElement | null>) {
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [isOpen, setIsOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const selectionRef = useRef<HTMLDivElement>(null);

  function open() {
    setIsOpen(true);
  }

  function close() {
    setDrag(null);
    setIsOpen(false);
  }

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
    setCrop(
      drag.handle === "move"
        ? moveCrop(drag.crop, deltaX, deltaY)
        : resizeCrop(drag.crop, drag.handle, deltaX, deltaY),
    );
  }

  function finishDrag() {
    if (!drag) return;
    setDrag(null);
  }

  return {
    crop,
    isEditing: isOpen || drag !== null,
    isOpen,
    selectionRef,
    open,
    close,
    startDrag,
    moveDrag,
    finishDrag,
  };
}
