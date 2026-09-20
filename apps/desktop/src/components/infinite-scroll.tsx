import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/class-names.utils";

interface InfiniteScrollTriggerProps {
  hasMore: boolean;
  isLoading?: boolean;
  loader?: ReactNode;
  next: () => void;
  rootMargin?: string;
}

type InfiniteScrollProps = ComponentProps<"div"> & InfiniteScrollTriggerProps;

const DEFAULT_ROOT_MARGIN = "0px 0px 600px";

function InfiniteScroll({
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
  hasMore,
  isLoading = false,
  loader: propsLoader,
  next,
  rootMargin = DEFAULT_ROOT_MARGIN,
}: InfiniteScrollTriggerProps) {
  const { sentinelRef } = useInfiniteScroll({
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
  hasMore,
  isLoading,
  next,
  rootMargin = DEFAULT_ROOT_MARGIN,
}: Omit<InfiniteScrollTriggerProps, "loader">) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);
  const isIntersectingRef = useRef(false);
  const requestPendingRef = useRef(false);
  const nextRef = useRef(next);

  useEffect(() => {
    hasMoreRef.current = hasMore;
    isLoadingRef.current = isLoading;
    nextRef.current = next;

    if (isLoading) {
      requestPendingRef.current = false;
    }
    if (!hasMore) requestPendingRef.current = false;
  }, [hasMore, isLoading, next]);

  useEffect(() => {
    if (!hasMore || isLoading || !isIntersectingRef.current || requestPendingRef.current) {
      return;
    }

    requestPendingRef.current = true;
    nextRef.current();
  }, [hasMore, isLoading]);

  useEffect(() => {
    const trigger = sentinelRef.current;
    if (!trigger || !hasMore || typeof IntersectionObserver === "undefined") return;
    const root = trigger.closest<HTMLElement>("[data-slot='scroll-area-viewport']");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          isIntersectingRef.current = false;
          requestPendingRef.current = false;
          return;
        }

        isIntersectingRef.current = true;

        if (!hasMoreRef.current) return;
        if (isLoadingRef.current || requestPendingRef.current) return;

        requestPendingRef.current = true;
        nextRef.current();
      },
      { root, rootMargin },
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  }, [hasMore, rootMargin]);

  return { sentinelRef };
}

export { InfiniteScroll, InfiniteScrollTrigger };
