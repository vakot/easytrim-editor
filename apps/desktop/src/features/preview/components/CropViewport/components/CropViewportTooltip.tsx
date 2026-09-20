import {
  type FocusEvent,
  forwardRef,
  type MouseEventHandler,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";

import { CursorTooltip } from "@/components/ui/cursor-tooltip";

import { usePlayback } from "@/app/hooks/usePlayback";

import type { Bounds } from "../../../lib/crop-frame.utils";

interface CropSelectionInteraction {
  close: () => void;
  finishDrag: () => void;
  isOpen: boolean;
  moveDrag: (event: PointerEvent<HTMLDivElement>, viewport: Bounds) => void;
}

interface CropViewportTooltipProps {
  children: ReactNode;
  containerRef: RefObject<HTMLDivElement | null>;
  cropSelection: CropSelectionInteraction;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  viewport: Bounds;
}

export const CropViewportTooltip = forwardRef<HTMLDivElement, CropViewportTooltipProps>(
  function CropViewportTooltip(
    { children, containerRef, cropSelection, onContextMenu, viewport },
    forwardedRef,
  ) {
    const { t } = useTranslation();
    const { toggle } = usePlayback();
    const { close, finishDrag, isOpen, moveDrag } = cropSelection;
    const setRefs = useCallback(
      (element: HTMLDivElement | null) => {
        containerRef.current = element;
        if (typeof forwardedRef === "function") forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      },
      [containerRef, forwardedRef],
    );

    const handleBlur = useCallback(
      (event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      },
      [close],
    );

    const handleClick = useCallback(() => {
      if (isOpen) {
        close();
        return;
      }
      toggle({ type: "button", id: "preview.click" });
    }, [close, isOpen, toggle]);

    const handlePointerMove = useCallback(
      (event: PointerEvent<HTMLDivElement>) => {
        moveDrag(event, viewport);
      },
      [moveDrag, viewport],
    );

    return (
      <CursorTooltip
        aria-label={t("preview.accessibility.crop.preview")}
        className="group relative size-full overflow-hidden bg-preview-surface focus-visible:outline-none"
        disabled={isOpen}
        onBlur={handleBlur}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        onPointerCancel={finishDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        ref={setRefs}
        tabIndex={0}
        tooltipContent={t("preview.tooltips.crop")}
      >
        {children}
      </CursorTooltip>
    );
  },
);
