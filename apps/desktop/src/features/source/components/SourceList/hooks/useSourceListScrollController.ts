import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ListRange } from "react-virtuoso";

import { useAppDispatch } from "@/app/store/redux-hooks";
import {
  prepareImportedSourceThumbnailsRequested,
  releaseImportedSourceThumbnailDemand,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstanceListEntry } from "@/domain/editing-instance";

const THUMBNAIL_VIEWPORT_EXPANSION = 600;
const SCROLL_SEEK_ENTER_VELOCITY = 900;
const SCROLL_SEEK_EXIT_VELOCITY = 120;
const SCROLL_SETTLE_DELAY_MS = 140;

const increaseViewportBy = {
  bottom: THUMBNAIL_VIEWPORT_EXPANSION,
  top: THUMBNAIL_VIEWPORT_EXPANSION,
};

function useSourceListScrollController(sources: EditingInstanceListEntry[]) {
  const dispatch = useAppDispatch();
  const demandedIdsRef = useRef(new Set<string>());
  const rangeRef = useRef<ListRange | null>(null);
  const scrollSeekingRef = useRef(false);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);

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

      const first = Math.max(0, range.startIndex);
      const last = Math.min(sources.length - 1, range.endIndex);
      const nextIds = new Set(sources.slice(first, last + 1).map(({ id }) => id));
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

  const handleScrollSeekChange = useCallback(() => {
    scrollSeekingRef.current = true;
    releaseDemand(demandedIdsRef.current);
  }, [releaseDemand]);

  const scrollSeekConfiguration = useMemo(
    () => ({
      change: handleScrollSeekChange,
      enter: (velocity: number) => Math.abs(velocity) >= SCROLL_SEEK_ENTER_VELOCITY,
      exit: (velocity: number) => Math.abs(velocity) <= SCROLL_SEEK_EXIT_VELOCITY,
    }),
    [handleScrollSeekChange],
  );

  useEffect(() => {
    if (!scrollParent) return;

    let previousScrollTop = scrollParent.scrollTop;
    let previousTime = performance.now();

    const handleScroll = () => {
      const now = performance.now();
      const elapsed = Math.max(1, now - previousTime);
      const velocity = ((scrollParent.scrollTop - previousScrollTop) / elapsed) * 1000;
      previousScrollTop = scrollParent.scrollTop;
      previousTime = now;

      if (Math.abs(velocity) >= SCROLL_SEEK_ENTER_VELOCITY) handleScrollSeekChange();
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = setTimeout(() => {
        scrollSeekingRef.current = false;
        if (rangeRef.current) updateDemandForRange(rangeRef.current);
      }, SCROLL_SETTLE_DELAY_MS);
    };

    scrollParent.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollParent.removeEventListener("scroll", handleScroll);
  }, [handleScrollSeekChange, scrollParent, updateDemandForRange]);

  useEffect(() => {
    const sourceIds = new Set(sources.map(({ id }) => id));
    releaseDemand([...demandedIdsRef.current].filter((id) => !sourceIds.has(id)));
  }, [releaseDemand, sources]);

  useEffect(
    () => () => {
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
      releaseDemand(demandedIdsRef.current);
    },
    [releaseDemand],
  );

  return {
    customScrollParent: scrollParent,
    increaseViewportBy,
    rangeChanged: updateDemandForRange,
    scrollSeekConfiguration,
    setScrollParent,
  };
}

export { useSourceListScrollController };
