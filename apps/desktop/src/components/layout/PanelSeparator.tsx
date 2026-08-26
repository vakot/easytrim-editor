import { Separator as ResizeSeparator } from "react-resizable-panels";
import type { MouseEventHandler } from "react";

import { cn } from "@/lib/utils";

interface PanelSeparatorProps {
  id: string;
  label?: string;
  orientation: "horizontal" | "vertical";
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
  disabled?: boolean;
  children?: React.ReactNode;
  collapsed?: boolean;
  className?: string;
}

export function PanelSeparator({
  id,
  label,
  orientation,
  onDoubleClick,
  disabled = false,
  children,
  collapsed = false,
  className,
}: PanelSeparatorProps) {
  return (
    <ResizeSeparator
      disabled={disabled}
      disableDoubleClick={onDoubleClick !== undefined}
      onDoubleClick={onDoubleClick}
      id={id}
      aria-label={label}
      aria-hidden={disabled ? true : undefined}
      className={cn(
        "group relative z-20 shrink-0 bg-transparent outline-none",
        disabled && "pointer-events-none hidden",
        orientation === "vertical" ? "w-1" : "h-1",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-10 rounded transition-colors group-hover:bg-primary/70 group-focus-visible:bg-primary group-data-[separator=active]:bg-primary group-data-[separator=drag]:bg-primary" />
      <PanelSeparatorContent orientation={orientation} collapsed={collapsed}>
        {children}
      </PanelSeparatorContent>
    </ResizeSeparator>
  );
}

type PanelSeparatorContentProps = Pick<
  PanelSeparatorProps,
  "children" | "orientation" | "collapsed"
>;

function PanelSeparatorContent({ children, orientation, collapsed }: PanelSeparatorContentProps) {
  if (children) return children;
  if (collapsed) return null;

  return (
    <div
      className={cn(
        "absolute left-1/2 top-1/2 -translate-1/2 flex gap-0.5",
        orientation === "vertical" ? "flex-col" : "flex-row",
      )}
    >
      <div aria-hidden="true" className="size-0.5 rounded-full bg-secondary-foreground" />
      <div aria-hidden="true" className="size-0.5 rounded-full bg-secondary-foreground" />
      <div aria-hidden="true" className="size-0.5 rounded-full bg-secondary-foreground" />
    </div>
  );
}
