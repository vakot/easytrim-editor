import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/class-names.utils";

interface InfiniteScrollTriggerProps {
  hasMore: boolean;
  isLoading?: boolean;
  loader?: ReactNode;
  maxPendingRequests?: number;
  next: () => void;
  requestDelayMs?: number;
  rootMargin?: string;
}

type InfiniteScrollProps = ComponentProps<"div"> & InfiniteScrollTriggerProps;

const DEFAULT_ROOT_MARGIN = "0px 0px 600px";
const DEFAULT_MAX_PENDING_REQUESTS = 1;
const DEFAULT_REQUEST_DELAY_MS = 300;

function InfiniteScroll({
  children,
  className,
  hasMore,
  isLoading = false,
  loader,
  maxPendingRequests = DEFAULT_MAX_PENDING_REQUESTS,
  next,
  requestDelayMs = DEFAULT_REQUEST_DELAY_MS,
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
        maxPendingRequests={maxPendingRequests}
        next={next}
        requestDelayMs={requestDelayMs}
        rootMargin={rootMargin}
      />
    </div>
  );
}

function InfiniteScrollTrigger({
  hasMore,
  isLoading = false,
  loader: propsLoader,
  maxPendingRequests = DEFAULT_MAX_PENDING_REQUESTS,
  next,
  requestDelayMs = DEFAULT_REQUEST_DELAY_MS,
  rootMargin = DEFAULT_ROOT_MARGIN,
}: InfiniteScrollTriggerProps) {
  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    next,
    isLoading,
    maxPendingRequests,
    requestDelayMs,
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
  maxPendingRequests = DEFAULT_MAX_PENDING_REQUESTS,
  next,
  requestDelayMs = DEFAULT_REQUEST_DELAY_MS,
  rootMargin = DEFAULT_ROOT_MARGIN,
}: Omit<InfiniteScrollTriggerProps, "loader">) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);
  const nextRequestedRef = useRef(false);
  const pendingRequestsRef = useRef(0);
  const nextRef = useRef(next);
  const requestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIntersectingRef = useRef(false);
  const pendingRequestLimit = Math.max(1, maxPendingRequests);

  const scheduleNext = useCallback(() => {
    if (!hasMoreRef.current || nextRequestedRef.current) return;

    nextRequestedRef.current = true;

    const request = () => {
      requestTimerRef.current = null;

      if (isLoadingRef.current) {
        nextRequestedRef.current = false;
        pendingRequestsRef.current = Math.min(
          pendingRequestsRef.current + 1,
          pendingRequestLimit,
        );
        return;
      }

      nextRef.current();
    };

    if (requestDelayMs > 0) {
      requestTimerRef.current = setTimeout(request, requestDelayMs);
    } else {
      request();
    }
  }, [maxPendingRequests, requestDelayMs]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
    isLoadingRef.current = isLoading;
    nextRef.current = next;

    if (!hasMore) {
      pendingRequestsRef.current = 0;
      if (requestTimerRef.current) {
        clearTimeout(requestTimerRef.current);
        requestTimerRef.current = null;
      }
      return;
    }

    if (isLoading) {
      nextRequestedRef.current = false;
      if (isIntersectingRef.current) {
        pendingRequestsRef.current = Math.min(
          Math.max(pendingRequestsRef.current, 1),
          pendingRequestLimit,
        );
      }
      return;
    }

    if (pendingRequestsRef.current > 0) {
      pendingRequestsRef.current -= 1;
      scheduleNext();
    }
  }, [hasMore, isLoading, next, pendingRequestLimit, scheduleNext]);

  useEffect(() => {
    const trigger = sentinelRef.current;
    if (!trigger || !hasMore || typeof IntersectionObserver === "undefined") return;
    const root = trigger.closest<HTMLElement>("[data-slot='scroll-area-viewport']");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          isIntersectingRef.current = false;
          pendingRequestsRef.current = 0;
          nextRequestedRef.current = false;
          if (requestTimerRef.current) {
            clearTimeout(requestTimerRef.current);
            requestTimerRef.current = null;
          }
          return;
        }

        isIntersectingRef.current = true;

        if (!hasMoreRef.current) return;

        if (isLoadingRef.current) {
          pendingRequestsRef.current = Math.min(
            pendingRequestsRef.current + 1,
            pendingRequestLimit,
          );
          return;
        }

        scheduleNext();
      },
      { root, rootMargin },
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  }, [hasMore, pendingRequestLimit, rootMargin, scheduleNext]);

  useEffect(
    () => () => {
      if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
    },
    [],
  );

  return { sentinelRef };
}

export { InfiniteScroll, InfiniteScrollTrigger };
