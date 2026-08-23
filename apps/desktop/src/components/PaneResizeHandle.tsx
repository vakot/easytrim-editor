import { Separator as ResizeSeparator } from "react-resizable-panels";
import type { FocusEventHandler, MouseEventHandler, PointerEventHandler } from "react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface PaneResizeHandleProps {
  id: string;
  label: string;
  orientation: "horizontal" | "vertical";
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
  onFocus?: FocusEventHandler<HTMLDivElement>;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  disabled?: boolean;
}

export function PaneResizeHandle({
  id,
  label,
  orientation,
  onDoubleClick,
  onFocus,
  onPointerEnter,
  disabled = false,
}: PaneResizeHandleProps) {
  return (
    <ResizeSeparator
      disabled={disabled}
      disableDoubleClick={onDoubleClick !== undefined}
      onDoubleClick={onDoubleClick}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
      id={id}
      aria-label={label}
      aria-hidden={disabled}
      className={cn(
        "group relative z-20 shrink-0 bg-transparent outline-none",
        disabled && "pointer-events-none hidden",
        orientation === "vertical" ? "w-2" : "h-2",
      )}
    >
      <Separator
        orientation={orientation}
        className={cn(
          "pointer-events-none transition-colors group-hover:bg-primary/70 group-focus-visible:bg-primary group-data-[separator=active]:bg-primary group-data-[separator=drag]:bg-primary",
          orientation === "vertical"
            ? "absolute inset-y-0 left-1/2 h-full -translate-x-1/2"
            : "absolute inset-x-0 top-1/2 w-full -translate-y-1/2",
        )}
      />
    </ResizeSeparator>
  );
}
