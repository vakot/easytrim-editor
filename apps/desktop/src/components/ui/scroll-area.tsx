"use client";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

type ScrollAreaOrientation = "horizontal" | "vertical";

function ScrollArea({
  children,
  className,
  orientation = "vertical",
  viewportRef,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  orientation?: ScrollAreaOrientation;
  viewportRef?: (element: HTMLDivElement | null) => void;
}) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn(
        "relative overflow-hidden",
        orientation === "horizontal" ? "min-w-0" : "min-h-0",
        className,
      )}
      data-slot="scroll-area"
      {...props}
    >
      {/* The viewport is the scroller, so it carries the scroll-driven edge fade. */}
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "scroll-area-viewport size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-[0.0625rem] [&>div]:block!",
          orientation === "horizontal"
            ? "scroll-fade-x overflow-x-auto overflow-y-hidden"
            : "scroll-fade-y overflow-x-hidden",
        )}
        data-slot="scroll-area-viewport"
        ref={viewportRef}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollBar orientation={orientation} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      className={cn(
        "z-20 flex touch-none transition-colors select-none data-horizontal:h-1.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-1.5 data-vertical:border-l data-vertical:border-l-transparent",
        className,
      )}
      data-orientation={orientation}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className="relative flex-1 rounded-full bg-border"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
