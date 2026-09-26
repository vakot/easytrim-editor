import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type ListProps,
  type ListRange,
  type ScrollSeekPlaceholderProps,
  Virtuoso,
} from "react-virtuoso";

import { useAppDispatch } from "@/app/store/redux-hooks";
import {
  prepareImportedSourceThumbnailsRequested,
  releaseImportedSourceThumbnailDemand,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstanceListEntry } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";

import { useSourceListData } from "../contexts/SourceListContext";

import { SourceListItem } from "./SourceListItem";

const THUMBNAIL_VIEWPORT_EXPANSION = 600;
const SCROLL_SEEK_ENTER_VELOCITY = 900;
const SCROLL_SEEK_EXIT_VELOCITY = 120;
const SCROLL_SETTLE_DELAY_MS = 140;

const SourceListVirtualizedList = forwardRef<HTMLDivElement, ListProps<HTMLDivElement>>(
  function SourceListVirtualizedList({ children, style }, ref) {
    return (
      <div
        className="flex flex-col gap-2 py-2"
        data-slot="imported-sources-grid"
        ref={ref}
        role="list"
        style={style}
      >
        {children}
      </div>
    );
  },
);

function SourceListScrollSeekPlaceholder({ height }: ScrollSeekPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className="flex min-w-0 gap-2 p-2"
      role="presentation"
      style={{ height }}
    >
      <div className="aspect-video w-40 shrink-0 animate-pulse self-center rounded-md bg-muted" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
        <div className="mt-auto flex gap-2">
          <div className="h-3 w-12 animate-pulse rounded bg-muted/70" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

const virtuosoComponents = {
  List: SourceListVirtualizedList,
  ScrollSeekPlaceholder: SourceListScrollSeekPlaceholder,
};

interface SourceListContentProps {
  className?: string;
}

function SourceListContent({ className }: SourceListContentProps) {
  const dispatch = useAppDispatch();
  const { matchesBySourceId, search, sources } = useSourceListData();
  const { t } = useTranslation();
  const demandedIdsRef = useRef(new Set<string>());
  const rangeRef = useRef<ListRange | null>(null);
  const scrollSeekingRef = useRef(false);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(null);

  const sourceEntriesById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const releaseDemand = useCallback(
    (sourceIds: Iterable<string>) => {
      for (const sourceId of sourceIds) {
        if (!demandedIdsRef.current.delete(sourceId)) continue;
        dispatch(releaseImportedSourceThumbnailDemand(sourceId));
      }
    },
    [dispatch],
  );

  const updateDemandForRange = useCallback(
    (range: ListRange) => {
      rangeRef.current = range;
      if (scrollSeekingRef.current) return;

      const currentSources = sources;
      const first = Math.max(0, range.startIndex);
      const last = Math.min(currentSources.length - 1, range.endIndex);
      const nextIds = new Set(currentSources.slice(first, last + 1).map(({ id }) => id));
      releaseDemand([...demandedIdsRef.current].filter((id) => !nextIds.has(id)));

      const newlyDemanded: EditingInstanceListEntry[] = [];
      for (const sourceId of nextIds) {
        if (demandedIdsRef.current.has(sourceId)) continue;
        const source = sourceEntriesById.get(sourceId);
        if (!source) continue;
        demandedIdsRef.current.add(sourceId);
        newlyDemanded.push(source);
      }

      if (newlyDemanded.length > 0) {
        dispatch(prepareImportedSourceThumbnailsRequested(newlyDemanded));
      }
    },
    [dispatch, releaseDemand, sourceEntriesById, sources],
  );

  const handleRangeChanged = useCallback(
    (range: ListRange) => updateDemandForRange(range),
    [updateDemandForRange],
  );

  const handleScrollSeekChange = useCallback(() => {
    scrollSeekingRef.current = true;
    releaseDemand(demandedIdsRef.current);
  }, [releaseDemand]);

  const handleScrollerRef = useCallback((element: HTMLElement | Window | null) => {
    setScrollerElement(element instanceof HTMLElement ? element : null);
  }, []);

  useEffect(() => {
    if (!scrollerElement) return;

    let previousScrollTop = scrollerElement.scrollTop;
    let previousTime = performance.now();

    const handleScroll = () => {
      const now = performance.now();
      const elapsed = Math.max(1, now - previousTime);
      const velocity = ((scrollerElement.scrollTop - previousScrollTop) / elapsed) * 1000;
      previousScrollTop = scrollerElement.scrollTop;
      previousTime = now;

      if (Math.abs(velocity) >= SCROLL_SEEK_ENTER_VELOCITY) handleScrollSeekChange();
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = setTimeout(() => {
        scrollSeekingRef.current = false;
        if (rangeRef.current) updateDemandForRange(rangeRef.current);
      }, SCROLL_SETTLE_DELAY_MS);
    };

    scrollerElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollerElement.removeEventListener("scroll", handleScroll);
  }, [handleScrollSeekChange, scrollerElement, updateDemandForRange]);

  useEffect(() => {
    const filteredSourceIds = new Set(sources.map(({ id }) => id));
    releaseDemand([...demandedIdsRef.current].filter((id) => !filteredSourceIds.has(id)));
  }, [releaseDemand, sources]);

  useEffect(
    () => () => {
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
      releaseDemand(demandedIdsRef.current);
    },
    [releaseDemand],
  );

  if (search.trim() && sources.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground" role="status">
        {t("source.messages.noSearchResults")}
      </div>
    );
  }

  return (
    <Virtuoso
      className={cn("size-full min-h-0", className)}
      components={virtuosoComponents}
      computeItemKey={(_, source) => source.id}
      data={sources}
      defaultItemHeight={112}
      increaseViewportBy={{
        bottom: THUMBNAIL_VIEWPORT_EXPANSION,
        top: THUMBNAIL_VIEWPORT_EXPANSION,
      }}
      itemContent={(_, source) => (
        <SourceListItem match={matchesBySourceId.get(source.id)} source={source} />
      )}
      rangeChanged={handleRangeChanged}
      scrollerRef={handleScrollerRef}
      scrollSeekConfiguration={{
        change: handleScrollSeekChange,
        enter: (velocity) => Math.abs(velocity) >= SCROLL_SEEK_ENTER_VELOCITY,
        exit: (velocity) => Math.abs(velocity) <= SCROLL_SEEK_EXIT_VELOCITY,
      }}
      style={{ height: "100%" }}
    />
  );
}

export { SourceListContent };
