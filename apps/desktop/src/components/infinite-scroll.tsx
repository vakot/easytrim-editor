import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/class-names.utils";

interface InfiniteScrollTriggerProps {
  hasMore: boolean;
  isLoading?: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

type InfiniteScrollProps = ComponentProps<"div"> & InfiniteScrollTriggerProps;

function InfiniteScroll({
  children,
  className,
  hasMore,
  isLoading = false,
  onLoadMore,
  rootMargin = "0px 0px 200px",
  ...props
}: InfiniteScrollProps) {
  return (
    <div className={cn("min-w-0", className)} data-slot="infinite-scroll" {...props}>
      {children}
      <InfiniteScrollTrigger
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={onLoadMore}
        rootMargin={rootMargin}
      />
    </div>
  );
}

function InfiniteScrollTrigger({
  hasMore,
  isLoading = false,
  onLoadMore,
  rootMargin = "0px 0px 200px",
}: InfiniteScrollTriggerProps) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || !hasMore || isLoading || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMore();
      },
      { rootMargin },
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore, rootMargin]);

  if (!hasMore) return null;

  return (
    <div
      aria-busy={isLoading}
      className="flex min-h-4 items-center justify-center p-2 text-sm text-muted-foreground"
      data-slot="infinite-scroll-trigger"
      ref={triggerRef}
    >
      {isLoading ? <span role="status">Loading…</span> : null}
    </div>
  );
}

export { InfiniteScroll, InfiniteScrollTrigger };
