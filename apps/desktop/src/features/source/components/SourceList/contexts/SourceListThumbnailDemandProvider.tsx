import { type ReactNode, useCallback, useEffect, useRef } from "react";

import {
  type RegisterThumbnailDemand,
  SourceListThumbnailDemandContext,
} from "./SourceListThumbnailDemandContext";

interface ThumbnailDemandTarget {
  demanded: boolean;
  release: () => void;
  request: () => void;
}

const SOURCE_THUMBNAIL_DEMAND_ROOT_MARGIN = "600px 0px";

function SourceListThumbnailDemandProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetsRef = useRef(new Map<Element, ThumbnailDemandTarget>());

  const register = useCallback<RegisterThumbnailDemand>((element, request, release) => {
    const target: ThumbnailDemandTarget = { demanded: false, release, request };
    targetsRef.current.set(element, target);

    const observer = observerRef.current;
    if (observer) observer.observe(element);
    else if (typeof IntersectionObserver === "undefined") {
      target.demanded = true;
      target.request();
    }

    return () => {
      observerRef.current?.unobserve(element);
      targetsRef.current.delete(element);
      if (target.demanded) target.release();
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = targetsRef.current;
    const root = containerRef.current?.closest<HTMLElement>("[data-slot='scroll-area-viewport']");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = targets.get(entry.target);
          if (!target || target.demanded === entry.isIntersecting) continue;
          target.demanded = entry.isIntersecting;
          if (target.demanded) target.request();
          else target.release();
        }
      },
      { root, rootMargin: SOURCE_THUMBNAIL_DEMAND_ROOT_MARGIN },
    );

    observerRef.current = observer;
    for (const element of targets.keys()) observer.observe(element);

    return () => {
      observer.disconnect();
      observerRef.current = null;
      for (const target of targets.values()) {
        if (!target.demanded) continue;
        target.demanded = false;
        target.release();
      }
    };
  }, []);

  return (
    <SourceListThumbnailDemandContext.Provider value={register}>
      <div className="min-w-0" ref={containerRef}>
        {children}
      </div>
    </SourceListThumbnailDemandContext.Provider>
  );
}

export { SourceListThumbnailDemandProvider };
