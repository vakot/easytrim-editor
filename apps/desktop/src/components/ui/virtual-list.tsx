import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/class-names.utils";

type VirtualListProps<TItem> = {
  className?: string;
  estimateSize: number | ((index: number) => number);
  getItemKey: (item: TItem, index: number) => string | number;
  items: readonly TItem[];
  onVirtualRangeChange?: (range: { endIndex: number; startIndex: number } | null) => void;
  overscan?: number;
  renderItem: (item: TItem, index: number) => ReactNode;
};

type ScrollAnchor = { key: string; keys: string[]; offset: number };

function VirtualList<TItem>({
  className,
  estimateSize,
  getItemKey,
  items,
  onVirtualRangeChange,
  overscan = 6,
  renderItem,
}: VirtualListProps<TItem>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const anchorRef = useRef<ScrollAnchor | null>(null);
  const previousKeysRef = useRef<string[] | null>(null);
  const pendingAnchorRef = useRef<ScrollAnchor | null>(null);
  const keys = useMemo(
    () => items.map((item, index) => String(getItemKey(item, index))),
    [getItemKey, items],
  );

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
  const firstVirtualIndex = virtualItems[0]?.index ?? -1;
  const lastVirtualIndex = virtualItems.at(-1)?.index ?? -1;
  const initialItems = virtualItems.length > 0 ? virtualItems : getFallbackItems();
  const totalSize =
    virtualizer.getTotalSize() ||
    items.reduce((size, _item, index) => size + getEstimatedSize(index), 0);

  const captureAnchor = useCallback(() => {
    const list = listRef.current;
    const viewport = list?.closest<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!list || !viewport) return null;

    const viewportTop = viewport.getBoundingClientRect().top;
    const viewportBottom = viewport.getBoundingClientRect().bottom;
    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-virtual-key]"));
    const visibleRow = rows
      .map((row) => ({ rect: row.getBoundingClientRect(), row }))
      .filter(({ rect }) => rect.bottom > viewportTop && rect.top < viewportBottom)
      .sort((left, right) => left.rect.top - right.rect.top)[0];

    if (!visibleRow) return null;
    return {
      key: visibleRow.row.dataset.virtualKey ?? "",
      keys: keys.slice(),
      offset: visibleRow.rect.top - viewportTop,
    };
  }, [keys]);

  const restoreAnchor = useCallback(
    (anchor: ScrollAnchor) => {
      const list = listRef.current;
      const viewport = list?.closest<HTMLElement>("[data-slot='scroll-area-viewport']");
      if (!list || !viewport) return;

      const currentKeys = keys;
      const anchorIndex = anchor.keys.indexOf(anchor.key);
      let targetKey = currentKeys.includes(anchor.key) ? anchor.key : undefined;
      if (targetKey === undefined && anchorIndex >= 0) {
        targetKey = anchor.keys.slice(anchorIndex + 1).find((key) => currentKeys.includes(key));
        targetKey ??= anchor.keys
          .slice(0, anchorIndex)
          .reverse()
          .find((key) => currentKeys.includes(key));
      }
      if (targetKey === undefined) return;

      const row = Array.from(list.querySelectorAll<HTMLElement>("[data-virtual-key]")).find(
        (candidate) => candidate.dataset.virtualKey === targetKey,
      );

      if (!row) {
        const targetIndex = currentKeys.indexOf(targetKey);
        if (targetIndex >= 0) {
          pendingAnchorRef.current = { ...anchor, key: targetKey };
          virtualizer.scrollToIndex(targetIndex, { align: "start" });
        }
        return;
      }

      const rowTop = row.getBoundingClientRect().top;
      const viewportTop = viewport.getBoundingClientRect().top;
      const offsetDelta = rowTop - viewportTop - anchor.offset;
      if (Math.abs(offsetDelta) > 0.5) viewport.scrollTop += offsetDelta;
      pendingAnchorRef.current = null;
      anchorRef.current = captureAnchor();
    },
    [captureAnchor, keys, virtualizer],
  );

  useLayoutEffect(() => {
    onVirtualRangeChange?.(
      firstVirtualIndex < 0 ? null : { endIndex: lastVirtualIndex, startIndex: firstVirtualIndex },
    );
  }, [firstVirtualIndex, lastVirtualIndex, onVirtualRangeChange]);

  useLayoutEffect(() => {
    const previousKeys = previousKeysRef.current;
    const collectionChanged =
      previousKeys !== null &&
      (previousKeys.length !== keys.length ||
        previousKeys.some((key, index) => key !== keys[index]));

    if (collectionChanged && anchorRef.current) {
      restoreAnchor(anchorRef.current);
    } else if (pendingAnchorRef.current) {
      restoreAnchor(pendingAnchorRef.current);
    } else {
      anchorRef.current = captureAnchor();
    }

    previousKeysRef.current = keys.slice();
  }, [captureAnchor, firstVirtualIndex, keys, lastVirtualIndex, restoreAnchor, scrollMargin]);

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

  useEffect(() => {
    const viewport = listRef.current?.closest<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) return;

    let frame = 0;
    const captureAfterScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        anchorRef.current = captureAnchor();
      });
    };

    viewport.addEventListener("scroll", captureAfterScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", captureAfterScroll);
    };
  }, [captureAnchor]);

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

    return (
      <div
        className="absolute top-0 left-0 box-content w-full pb-2"
        data-index={virtualItem.index}
        data-virtual-key={String(virtualItem.key)}
        key={virtualItem.key}
        ref={virtualizer.measureElement}
        style={{ transform: `translateY(${virtualItem.start - scrollMargin}px)` }}
      >
        {renderItem(item, virtualItem.index)}
      </div>
    );
  });

  return (
    <div className={cn("relative w-full", className)} ref={listRef}>
      <div className="relative w-full" style={{ height: `${totalSize}px` }}>
        {renderedItems}
      </div>
    </div>
  );
}

export { VirtualList };
export type { VirtualListProps };
