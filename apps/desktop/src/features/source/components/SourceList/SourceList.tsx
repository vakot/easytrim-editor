import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectSourceListEntries,
  selectSourceSearchEntries,
} from "@/app/store/slices/editing-instances-slice";
import {
  prepareImportedSourceThumbnailsRequested,
  releaseImportedSourceThumbnailDemand,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstanceListEntry } from "@/domain/editing-instance";

import { createSourceSearcher } from "../../lib/source-search.utils";

import { SourceListCloseAll } from "./components/SourceListCloseAll";
import { SourceListContent } from "./components/SourceListContent";
import { SourceListEmpty } from "./components/SourceListEmpty";
import { SourceListSearch } from "./components/SourceListSearch";
import type { SourceListState } from "./contexts/SourceListContext";
import { SourceListContext } from "./contexts/SourceListContext";

const SOURCE_LIST_PAGE_SIZE = 12;

interface SourceListProps {
  children?: ReactNode | ((state: Pick<SourceListState, "search" | "sources">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const dispatch = useAppDispatch();
  const sources = useAppSelector(selectSourceListEntries);
  const searchEntries = useAppSelector(selectSourceSearchEntries);
  const [search, setSearch] = useState("");
  const [visibleSourceCount, setVisibleSourceCount] = useState(SOURCE_LIST_PAGE_SIZE);
  const registrations = useRef(
    new Map<string, { element: HTMLElement; entry: EditingInstanceListEntry }>(),
  );

  const observerRef = useRef<IntersectionObserver | null>(null);

  const searchSources = useMemo(() => createSourceSearcher(searchEntries), [searchEntries]);
  const searchResults = useMemo(() => searchSources(search), [search, searchSources]);
  const sourcesById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const filteredSources = useMemo(
    () =>
      searchResults.flatMap(({ source }) => {
        const entry = sourcesById.get(source.id);
        return entry ? [entry] : [];
      }),
    [searchResults, sourcesById],
  );

  const matchesBySourceId = useMemo(
    () => new Map(searchResults.map((result) => [result.source.id, result])),
    [searchResults],
  );

  const visibleSources = useMemo(
    () => filteredSources.slice(0, visibleSourceCount),
    [filteredSources, visibleSourceCount],
  );

  const hasMore = visibleSources.length < filteredSources.length;
  const next = useCallback(() => {
    setVisibleSourceCount((count) => count + SOURCE_LIST_PAGE_SIZE);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setVisibleSourceCount(SOURCE_LIST_PAGE_SIZE);
  }, []);

  const registerThumbnailDemand = useCallback(
    (entry: EditingInstanceListEntry, element: HTMLElement | null) => {
      const previous = registrations.current.get(entry.id);
      if (previous && previous.element !== element)
        observerRef.current?.unobserve(previous.element);

      if (!element) {
        registrations.current.delete(entry.id);
        void dispatch(releaseImportedSourceThumbnailDemand(entry.id));
        return;
      }

      registrations.current.set(entry.id, { element, entry });
      observerRef.current?.observe(element);
    },
    [dispatch],
  );

  const visibleSourceIds = visibleSources.map(({ id }) => id).join(",");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const currentRegistrations = registrations.current;
    const firstElement = currentRegistrations.values().next().value?.element;
    if (!firstElement) return;

    const root = firstElement.closest<HTMLElement>("[data-slot='scroll-area-viewport']");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const intersection of entries) {
          const registration = [...currentRegistrations.values()].find(
            ({ element }) => element === intersection.target,
          );

          if (!registration) continue;
          if (intersection.isIntersecting) {
            dispatch(prepareImportedSourceThumbnailsRequested([registration.entry]));
          } else {
            dispatch(releaseImportedSourceThumbnailDemand(registration.entry.id));
          }
        }
      },
      { root, rootMargin: "600px 0px" },
    );

    observerRef.current = observer;
    for (const { element } of currentRegistrations.values()) observer.observe(element);

    return () => {
      observer.disconnect();
      observerRef.current = null;
      for (const { entry } of currentRegistrations.values()) {
        dispatch(releaseImportedSourceThumbnailDemand(entry.id));
      }
    };
  }, [dispatch, visibleSourceIds]);

  if (sources.length === 0) return <SourceListEmpty />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources }) : children;

  return (
    <SourceListContext.Provider
      value={{
        hasMore,
        matchesBySourceId,
        next,
        registerThumbnailDemand,
        search,
        setSearch: handleSearchChange,
        sources: filteredSources,
        visibleSources,
      }}
    >
      {child ?? <SourceListContent />}
    </SourceListContext.Provider>
  );
}

export {
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  type SourceListProps,
  SourceListSearch,
};
