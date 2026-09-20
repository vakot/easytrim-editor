import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/class-names.utils";

interface InfiniteScrollTriggerProps {
  batchSize?: number;
  hasMore: boolean;
  isLoading?: boolean;
  loader?: ReactNode;
  next: () => void;
  rootMargin?: string;
}

type InfiniteScrollProps = ComponentProps<"div"> & InfiniteScrollTriggerProps;

const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_ROOT_MARGIN = "0px 0px 600px";

function InfiniteScroll({
  batchSize = DEFAULT_BATCH_SIZE,
  children,
  className,
  hasMore,
  isLoading = false,
  loader,
  next,
  rootMargin = DEFAULT_ROOT_MARGIN,
  ...props
}: InfiniteScrollProps) {
  return (
    <div className={cn("min-w-0", className)} data-slot="infinite-scroll" {...props}>
      {children}
      <InfiniteScrollTrigger
        batchSize={batchSize}
        hasMore={hasMore}
        isLoading={isLoading}
        loader={loader}
        next={next}
        rootMargin={rootMargin}
      />
    </div>
  );
}

function InfiniteScrollTrigger({
  batchSize = DEFAULT_BATCH_SIZE,
  hasMore,
  isLoading = false,
  loader: propsLoader,
  next,
  rootMargin = DEFAULT_ROOT_MARGIN,
}: InfiniteScrollTriggerProps) {
  const { sentinelRef } = useInfiniteScroll({
    batchSize,
    hasMore,
    isLoading,
    next,
    rootMargin,
  });

  const loader = propsLoader ?? <span role="status">Loading…</span>;

  if (!hasMore) return null;

  return (
    <div
      aria-busy={isLoading}
      className="flex min-h-4 items-center justify-center p-2 text-sm text-muted-foreground"
      data-slot="infinite-scroll-trigger"
      ref={sentinelRef}
    >
      {isLoading ? loader : null}
    </div>
  );
}

function useInfiniteScroll({
  batchSize = DEFAULT_BATCH_SIZE,
  hasMore,
  isLoading,
  next,
  rootMargin = DEFAULT_ROOT_MARGIN,
}: Omit<InfiniteScrollTriggerProps, "loader">) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);
  const activeBatchCountRef = useRef(isLoading ? 1 : 0);
  const wasLoadingRef = useRef(isLoading);
  const nextRef = useRef(next);
  const batchLimit = Math.max(1, batchSize);

  useEffect(() => {
    hasMoreRef.current = hasMore;
    isLoadingRef.current = isLoading;
    nextRef.current = next;

    if (!hasMore) {
      activeBatchCountRef.current = 0;
      wasLoadingRef.current = isLoading;
      return;
    }

    activeBatchCountRef.current = Math.min(activeBatchCountRef.current, batchLimit);

    if (isLoading) {
      wasLoadingRef.current = true;
      return;
    }

    const finishedBatch = wasLoadingRef.current;
    wasLoadingRef.current = false;

    if (!finishedBatch) return;

    activeBatchCountRef.current = Math.max(0, activeBatchCountRef.current - 1);

    if (activeBatchCountRef.current > 0) nextRef.current();
  }, [batchLimit, hasMore, isLoading, next]);

  useEffect(() => {
    const trigger = sentinelRef.current;
    if (!trigger || !hasMore || typeof IntersectionObserver === "undefined") return;
    const root = trigger.closest<HTMLElement>("[data-slot='scroll-area-viewport']");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          activeBatchCountRef.current = isLoadingRef.current ? 1 : 0;
          return;
        }

        if (!hasMoreRef.current) return;

        if (isLoadingRef.current) {
          activeBatchCountRef.current = batchLimit;
          return;
        }

        if (activeBatchCountRef.current >= batchLimit) return;

        activeBatchCountRef.current =
          activeBatchCountRef.current === 0
            ? batchLimit
            : activeBatchCountRef.current + 1;
        nextRef.current();
      },
      { root, rootMargin },
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  }, [batchLimit, hasMore, rootMargin]);

  return { sentinelRef };
}

export { InfiniteScroll, InfiniteScrollTrigger };
