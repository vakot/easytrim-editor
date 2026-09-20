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

const DEFAULT_ROOT_MARGIN = "0px 0px 200px";

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
    next,
    isLoading,
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
  const nextRequestedRef = useRef(false);
  const pendingNextRef = useRef(false);
  const nextRef = useRef(next);

  hasMoreRef.current = hasMore;
  isLoadingRef.current = isLoading;
  nextRef.current = next;

  useEffect(() => {
    if (isLoading) {
      nextRequestedRef.current = false;
      return;
    }

    if (pendingNextRef.current && hasMore) {
      pendingNextRef.current = false;
      nextRequestedRef.current = true;
      next();
    }
  }, [hasMore, isLoading, next]);

  useEffect(() => {
    const trigger = sentinelRef.current;
    if (!trigger || !hasMore || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          pendingNextRef.current = false;
          nextRequestedRef.current = false;
          return;
        }

        if (!hasMoreRef.current) return;

        if (isLoadingRef.current) {
          pendingNextRef.current = true;
          return;
        }

        if (nextRequestedRef.current) return;

        nextRequestedRef.current = true;
        nextRef.current();
      },
      { rootMargin },
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  }, [hasMore, rootMargin]);

  return { sentinelRef };
}

export { InfiniteScroll, InfiniteScrollTrigger };
