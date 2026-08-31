"use client";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

import styles from "./scroll-area.module.css";

function ScrollArea({
  children,
  className,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const [scrollState, setScrollState] = React.useState({
    canScrollDown: false,
    canScrollUp: false,
  });

  const updateScrollState = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const { clientHeight, scrollHeight, scrollTop } = viewport;
    const nextScrollState = {
      canScrollDown: scrollHeight - clientHeight - scrollTop > 1,
      canScrollUp: scrollTop > 1,
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
  }, []);

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
        scrollState.canScrollUp && styles.canScrollUp,
        scrollState.canScrollDown && styles.canScrollDown,
        className,
      )}
      data-slot="scroll-area"
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className="scroll-area-viewport size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
        data-slot="scroll-area-viewport"
        onScroll={updateScrollState}
        ref={viewportRef}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollBar />
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
