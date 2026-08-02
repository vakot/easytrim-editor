import { Separator } from "react-resizable-panels";
import type { MouseEventHandler } from "react";

import { cn } from "@/lib/utils";

interface PaneResizeHandleProps {
  id: string;
  label: string;
  orientation: "horizontal" | "vertical";
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
}

export function PaneResizeHandle({ id, label, orientation, onDoubleClick }: PaneResizeHandleProps) {
  return (
    <Separator
      disableDoubleClick={onDoubleClick !== undefined}
      onDoubleClick={onDoubleClick}
      id={id}
      aria-label={label}
      className={cn(
        "group relative z-20 shrink-0 bg-border/60 outline-none transition-colors hover:bg-primary/70 focus-visible:bg-primary",
        orientation === "vertical"
          ? "w-px cursor-col-resize data-[resize-handle-active]:bg-primary"
          : "h-px cursor-row-resize data-[resize-handle-active]:bg-primary",
      )}
    />
  );
}
