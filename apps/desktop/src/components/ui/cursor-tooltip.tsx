import {
  type ComponentProps,
  forwardRef,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/class-names.utils";

interface CursorTooltipProps extends ComponentProps<"div"> {
  delayDuration?: number;
  disabled?: boolean;
  offset?: number;
  tooltipContent: ReactNode;
}

export const CursorTooltip = forwardRef<HTMLDivElement, CursorTooltipProps>(function CursorTooltip(
  {
    children,
    className,
    delayDuration = 500,
    disabled = false,
    offset = 12,
    onClick,
    onPointerEnter,
    onPointerLeave,
    onPointerMove,
    tooltipContent,
    ...props
  },
  ref,
) {
  const timerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function clearTooltip() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
    setPosition(null);
  }

  function updatePosition(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: event.clientX - bounds.left + offset,
      y: event.clientY - bounds.top + offset,
    });
  }

  function handlePointerEnter(event: PointerEvent<HTMLDivElement>) {
    onPointerEnter?.(event);
    if (disabled) return;
    updatePosition(event);
    setVisible(false);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPosition((currentPosition) => currentPosition ?? { x: offset, y: offset });
      setVisible(true);
    }, delayDuration);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event);
    if (!disabled) updatePosition(event);
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    clearTooltip();
    onPointerLeave?.(event);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    clearTooltip();
    onClick?.(event);
  }

  return (
    <div
      {...props}
      className={cn("relative", className)}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={ref}
    >
      {children}
      {visible && position && !disabled ? (
        <span
          className="pointer-events-none absolute z-10 rounded bg-foreground px-2 py-1 text-xs text-background shadow"
          role="tooltip"
          style={{ left: position.x, top: position.y }}
        >
          {tooltipContent}
        </span>
      ) : null}
    </div>
  );
});
