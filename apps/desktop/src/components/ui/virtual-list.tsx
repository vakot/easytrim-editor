import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence } from "motion/react";
import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/class-names.utils";

type VirtualListProps<TItem> = {
  className?: string;
  estimateSize: number | ((index: number) => number);
  getItemKey: (item: TItem, index: number) => string | number;
  items: readonly TItem[];
  overscan?: number;
  presenceData?: unknown;
  renderItem: (item: TItem, index: number) => ReactNode;
  renderVirtualItem?: (
    props: {
      index: number;
      item: TItem;
      key: string | number;
      measureRef: Ref<HTMLDivElement>;
      style: CSSProperties;
    },
    content: ReactNode,
  ) => ReactNode;
};

function VirtualList<TItem>({
  className,
  estimateSize,
  getItemKey,
  items,
  overscan = 6,
  presenceData,
  renderItem,
  renderVirtualItem,
}: VirtualListProps<TItem>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const getEstimatedSize = useCallback(
    (index: number) => (typeof estimateSize === "number" ? estimateSize : estimateSize(index)),
    [estimateSize],
  );

  const getVirtualItemKey = useCallback(
    (index: number) => {
      const item = items[index];
      return item === undefined ? index : getItemKey(item, index);
    },
    [getItemKey, items],
  );

  // TanStack's virtualizer exposes imperative measurement and scrolling APIs by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: getEstimatedSize,
    getItemKey: getVirtualItemKey,
    getScrollElement: () =>
      listRef.current?.closest<HTMLElement>("[data-slot='scroll-area-viewport']") ??
      (typeof document === "undefined" ? null : document.documentElement),
    initialRect: { height: 600, width: 400 },
    overscan,
    scrollMargin,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const initialItems = virtualItems.length > 0 ? virtualItems : getFallbackItems();
  const totalSize =
    virtualizer.getTotalSize() ||
    items.reduce((size, _item, index) => size + getEstimatedSize(index), 0);

  useLayoutEffect(() => {
    const list = listRef.current;
    const viewport = list?.closest<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!list || !viewport) return;

    const updateScrollMargin = () => {
      const offset = list.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
      setScrollMargin(viewport.scrollTop + offset);
    };

    updateScrollMargin();
    const resizeObserver = new ResizeObserver(updateScrollMargin);
    resizeObserver.observe(list);
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, []);

  function getFallbackItems() {
    let start = 0;

    return items.slice(0, overscan + 1).map((item, index) => {
      const virtualItem = { index, key: getItemKey(item, index), start };
      start += getEstimatedSize(index);
      return virtualItem;
    });
  }

  const renderedItems = initialItems.map((virtualItem) => {
    const item = items[virtualItem.index];
    if (item === undefined) return null;

    const style: CSSProperties = {
      translate: `0px ${virtualItem.start - scrollMargin}px`,
    };

    const content = renderItem(item, virtualItem.index);
    if (renderVirtualItem) {
      return renderVirtualItem(
        {
          index: virtualItem.index,
          item,
          key: String(virtualItem.key),
          measureRef: virtualizer.measureElement,
          style,
        },
        content,
      );
    }

    return (
      <div
        className="absolute top-0 left-0 box-content w-full pb-2"
        data-index={virtualItem.index}
        key={virtualItem.key}
        ref={virtualizer.measureElement}
        style={{ transform: `translateY(${virtualItem.start - scrollMargin}px)` }}
      >
        {content}
      </div>
    );
  });

  return (
    <div className={cn("relative w-full", className)} ref={listRef}>
      <div className="relative w-full" style={{ height: `${totalSize}px` }}>
        {renderVirtualItem ? (
          <AnimatePresence custom={presenceData} initial={false}>
            {renderedItems}
          </AnimatePresence>
        ) : (
          renderedItems
        )}
      </div>
    </div>
  );
}

export { VirtualList };
export type { VirtualListProps };
