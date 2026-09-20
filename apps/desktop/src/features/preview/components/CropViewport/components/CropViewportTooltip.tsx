import {
  type FocusEventHandler,
  type MouseEventHandler,
  type PointerEvent,
  type PointerEventHandler,
  type RefObject,
  type ReactNode,
  forwardRef,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";

import { CursorTooltip } from "@/components/ui/cursor-tooltip";

interface CropViewportTooltipProps {
  children: ReactNode;
  containerRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  onBlur: FocusEventHandler<HTMLDivElement>;
  onClick: () => void;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
}

export const CropViewportTooltip = forwardRef<HTMLDivElement, CropViewportTooltipProps>(
  function CropViewportTooltip(
    {
      children,
      containerRef,
      disabled,
      onBlur,
      onClick,
      onContextMenu,
      onPointerDown,
      onPointerCancel,
      onPointerMove,
      onPointerUp,
    },
    forwardedRef,
  ) {
    const { t } = useTranslation();
    const setRefs = useCallback(
      (element: HTMLDivElement | null) => {
        containerRef.current = element;
        if (typeof forwardedRef === "function") forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      },
      [containerRef, forwardedRef],
    );
    const handlePointerCancel = useCallback(
      (event: PointerEvent<HTMLDivElement>) => {
        onPointerCancel(event);
      },
      [onPointerCancel],
    );
    const handlePointerMove = useCallback(
      (event: PointerEvent<HTMLDivElement>) => {
        onPointerMove(event);
      },
      [onPointerMove],
    );

    return (
      <CursorTooltip
        aria-label={t("preview.accessibility.crop.preview")}
        className="group relative size-full overflow-hidden bg-preview-surface focus-visible:outline-none"
        disabled={disabled}
        onBlur={onBlur}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerCancel={handlePointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        ref={setRefs}
        tabIndex={0}
        tooltipContent={t("preview.tooltips.crop")}
      >
        {children}
      </CursorTooltip>
    );
  },
);
