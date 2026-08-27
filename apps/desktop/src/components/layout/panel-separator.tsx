import type { MouseEventHandler } from "react";

import { ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface PanelSeparatorProps {
  id: string;
  label: string;
  orientation: "horizontal" | "vertical";
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
  disabled?: boolean;
  collapsed?: boolean;
  className?: string;
}

export function PanelSeparator({
  id,
  label,
  orientation,
  onDoubleClick,
  disabled = false,
  collapsed = false,
  className,
}: PanelSeparatorProps) {
  return (
    <ResizableHandle
      disabled={disabled}
      disableDoubleClick={onDoubleClick !== undefined}
      onDoubleClick={onDoubleClick}
      id={id}
      aria-label={label}
      aria-hidden={disabled}
      className={cn(
        "group relative z-20 shrink-0 bg-transparent outline-none after:hidden",
        disabled && "pointer-events-none hidden",
        orientation === "vertical" ? "w-1" : "h-1 w-full aria-[orientation=horizontal]:h-1",
        className,
      )}
    >
      <div
        data-slot="panel-separator-line"
        className={cn(
          "pointer-events-none absolute bg-border",
          orientation === "vertical"
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2",
        )}
      />
      <div
        data-slot="panel-separator-overlay"
        className="pointer-events-none absolute inset-0 z-10 rounded transition-colors group-hover:bg-primary/70 group-focus-visible:bg-primary group-data-[separator=active]:bg-primary group-data-[separator=drag]:bg-primary"
      />
      {!collapsed ? (
        <div
          data-slot="panel-separator-marker"
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 flex -translate-1/2 gap-0.5",
            orientation === "vertical" ? "flex-col" : "flex-row",
          )}
        >
          <div aria-hidden="true" className="size-0.5 rounded-full bg-secondary-foreground" />
          <div aria-hidden="true" className="size-0.5 rounded-full bg-secondary-foreground" />
          <div aria-hidden="true" className="size-0.5 rounded-full bg-secondary-foreground" />
        </div>
      ) : null}
    </ResizableHandle>
  );
}
