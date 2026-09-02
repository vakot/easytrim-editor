"use client";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

import styles from "./scroll-area.module.css";

type ScrollAreaOrientation = "horizontal" | "vertical";

function ScrollArea({
  children,
  className,
  fadeColor,
  orientation = "vertical",
  scrollbarClassName,
  style,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  fadeColor?: string;
  orientation?: ScrollAreaOrientation;
  scrollbarClassName?: string;
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const [scrollState, setScrollState] = React.useState({
    canScrollDown: false,
    canScrollUp: false,
  });

  const updateScrollState = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const nextScrollState =
      orientation === "horizontal"
        ? {
            canScrollDown: viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft > 1,
            canScrollUp: viewport.scrollLeft > 1,
          }
        : {
            canScrollDown: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 1,
            canScrollUp: viewport.scrollTop > 1,
          };

    setScrollState((currentScrollState) => {
      if (
        currentScrollState.canScrollDown === nextScrollState.canScrollDown &&
        currentScrollState.canScrollUp === nextScrollState.canScrollUp
      ) {
        return currentScrollState;
      }

      return nextScrollState;
    });
  }, [orientation]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(viewport);

    const content = viewport.firstElementChild;
    if (content) resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [updateScrollState]);

  return (
    <ScrollAreaPrimitive.Root
      className={cn(
        "relative overflow-hidden",
        styles.scrollFade,
        orientation === "horizontal" && styles.horizontal,
        scrollState.canScrollUp && styles.canScrollUp,
        scrollState.canScrollDown && styles.canScrollDown,
        className,
      )}
      data-slot="scroll-area"
      {...props}
      style={{
        ...style,
        ...(fadeColor ? { "--scroll-area-fade-color": fadeColor } : {}),
      }}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "scroll-area-viewport size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 [&>div]:block!",
          orientation === "horizontal" ? "overflow-x-auto overflow-y-hidden" : "overflow-x-hidden",
        )}
        data-slot="scroll-area-viewport"
        onScroll={updateScrollState}
        ref={viewportRef}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollBar className={scrollbarClassName} orientation={orientation} />
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
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
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
