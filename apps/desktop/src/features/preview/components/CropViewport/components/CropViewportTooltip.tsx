import type { CSSProperties } from "react";
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

import { PREVIEW_TRANSITION_DURATION } from "../../../lib/preview-transition";

interface CropSelectionInteraction {
  close: () => void;
  finishDrag: () => void;
  isOpen: boolean;
  moveDrag: (event: PointerEvent<HTMLDivElement>) => void;
}

interface CropViewportTooltipProps {
  children: ReactNode;
  containerRef: RefObject<HTMLDivElement | null>;
  cropSelection: CropSelectionInteraction;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
}

const CropViewportTooltip = forwardRef<HTMLDivElement, CropViewportTooltipProps>(
  function CropViewportTooltip(
    { children, containerRef, cropSelection, onContextMenu },
    forwardedRef,
  ) {
    const { t } = useTranslation();
    const { toggle } = usePlayback();
    const { close, finishDrag, isOpen, moveDrag } = cropSelection;
    const transitionStyle = {
      "--preview-transition-duration": `${PREVIEW_TRANSITION_DURATION * 1000}ms`,
    } as CSSProperties;

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
        moveDrag(event);
      },
      [moveDrag],
    );

    return (
      <CursorTooltip
        aria-label={t("preview.accessibility.crop.preview")}
        className="group relative size-full bg-preview-surface focus-visible:outline-none"
        disabled={isOpen}
        onBlur={handleBlur}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        onPointerCancel={finishDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        ref={setRefs}
        style={transitionStyle}
        tabIndex={0}
        tooltipContent={t("preview.tooltips.crop")}
      >
        {children}
      </CursorTooltip>
    );
  },
);

export { CropViewportTooltip };
