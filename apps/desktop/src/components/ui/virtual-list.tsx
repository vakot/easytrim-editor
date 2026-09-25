import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useRef } from "react";

import { cn } from "@/lib/class-names.utils";

interface VirtualListProps<T> {
  className?: string;
  estimateSize: (index: number) => number;
  getItemKey: (index: number) => string;
  items: readonly T[];
  overscan?: number;
  renderItem: (item: T, index: number, isScrolling: boolean) => ReactNode;
}

function VirtualList<T>({
  className,
  estimateSize,
  getItemKey,
  items,
  overscan = 8,
  renderItem,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  // TanStack's virtualizer exposes imperative scroll and range APIs by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize,
    getItemKey,
    getScrollElement: () =>
      containerRef.current?.closest<HTMLElement>("[data-slot='scroll-area-viewport']") ??
      containerRef.current?.parentElement ??
      null,
    initialRect: { height: 720, width: 0 },
    overscan,
    observeElementRect: (instance, callback) => {
      const element = instance.scrollElement;
      if (!element) return;

      let observedHeight: number | undefined;
      const resizeObserver = new ResizeObserver(([entry]) => {
        if (!entry || entry.contentRect.height === observedHeight) return;
        observedHeight = entry.contentRect.height;
        callback({ height: entry.contentRect.height, width: entry.contentRect.width });
      });

      resizeObserver.observe(element);
      return () => resizeObserver.disconnect();
    },
  });

  return (
    <div
      className={cn("relative w-full", className)}
      data-slot="virtual-list"
      ref={containerRef}
      role="list"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];
        if (item === undefined) return null;

        return (
          <div
            className="absolute top-0 left-0 w-full"
            data-virtual-index={virtualItem.index}
            data-virtual-key={virtualItem.key}
            key={virtualItem.key}
            role="listitem"
            style={{
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(item, virtualItem.index, virtualizer.isScrolling)}
          </div>
        );
      })}
    </div>
  );
}

export { VirtualList };
export type { VirtualListProps };
