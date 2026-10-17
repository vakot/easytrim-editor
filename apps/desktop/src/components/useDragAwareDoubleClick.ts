import { useCallback, useEffect, useRef } from "react";

interface ActivePointer {
  clientX: number;
  clientY: number;
  moved: boolean;
  pointerId: number;
}

function useDragAwareDoubleClick<T extends HTMLElement>(
  onDoubleClick?: (event: React.MouseEvent<T>, pointerDownTarget: EventTarget | null) => void,
) {
  const activePointerRef = useRef<ActivePointer | null>(null);
  const pointerDownTargetRef = useRef<EventTarget | null>(null);
  const suppressDoubleClickRef = useRef(false);
  const suppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current);
    },
    [],
  );

  const onPointerDownCapture = useCallback((event: React.PointerEvent<T>) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    pointerDownTargetRef.current = event.target;
    activePointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
      pointerId: event.pointerId,
    };
  }, []);

  const onPointerMoveCapture = useCallback((event: React.PointerEvent<T>) => {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.pointerId !== event.pointerId) return;
    if (activePointer.clientX === event.clientX && activePointer.clientY === event.clientY) return;
    activePointer.moved = true;
  }, []);

  const onPointerUpCapture = useCallback((event: React.PointerEvent<T>) => {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.pointerId !== event.pointerId) return;
    activePointerRef.current = null;
    if (!activePointer.moved) return;

    suppressDoubleClickRef.current = true;
    if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current);
    suppressTimeoutRef.current = setTimeout(() => {
      suppressDoubleClickRef.current = false;
      suppressTimeoutRef.current = null;
    }, 0);
  }, []);

  const onPointerCancelCapture = useCallback((event: React.PointerEvent<T>) => {
    if (activePointerRef.current?.pointerId === event.pointerId) {
      activePointerRef.current = null;
      pointerDownTargetRef.current = null;
    }
  }, []);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<T>) => {
      if (suppressDoubleClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressDoubleClickRef.current = false;
        pointerDownTargetRef.current = null;
        if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current);
        suppressTimeoutRef.current = null;
        return;
      }

      onDoubleClick?.(event, pointerDownTargetRef.current);
      pointerDownTargetRef.current = null;
    },
    [onDoubleClick],
  );

  return {
    onDoubleClick: handleDoubleClick,
    onPointerCancelCapture,
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
  };
}

export { useDragAwareDoubleClick };
