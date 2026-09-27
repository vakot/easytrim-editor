import { useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectSourceListEntries,
  selectSourceSearchEntries,
} from "@/app/store/slices/editing-instances-slice";
import { closeEditingInstancesRequested } from "@/app/store/thunks/source-media-thunks";

import { createSourceSearcher } from "../../lib/source-search.utils";

import { SourceListCloseAll } from "./components/SourceListCloseAll";
import { SourceListContent } from "./components/SourceListContent";
import { SourceListEmpty } from "./components/SourceListEmpty";
import { SourceListSearch } from "./components/SourceListSearch";
import type { SourceListState } from "./contexts/SourceListContext";
import {
  SOURCE_LIST_CLOSE_ANIMATION_DURATION_MS,
  SourceListContext,
} from "./contexts/SourceListContext";

interface SourceListProps {
  children?: ReactNode | ((state: Pick<SourceListState, "search" | "sources">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const dispatch = useAppDispatch();
  const sources = useAppSelector(selectSourceListEntries);
  const searchEntries = useAppSelector(selectSourceSearchEntries);
  const [search, setSearch] = useState("");
  const [closingSourceIds, setClosingSourceIds] = useState<ReadonlySet<string>>(() => new Set());
  const prefersReducedMotion = useReducedMotion() === true;
  const hasSearchQuery = search.trim().length > 0;
  const searchSources = useMemo(() => createSourceSearcher(searchEntries), [searchEntries]);
  const searchResults = useMemo(
    () => (hasSearchQuery ? searchSources(search) : []),
    [hasSearchQuery, search, searchSources],
  );

  const sourcesById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const filteredSources = useMemo(() => {
    if (!hasSearchQuery) return sources;

    return searchResults.flatMap(({ source }) => {
      const entry = sourcesById.get(source.id);
      return entry ? [entry] : [];
    });
  }, [hasSearchQuery, searchResults, sources, sourcesById]);

  const matchesBySourceId = useMemo(
    () =>
      hasSearchQuery
        ? new Map(searchResults.map((result) => [result.source.id, result]))
        : new Map(),
    [hasSearchQuery, searchResults],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const requestCloseSources = useCallback(
    (sourceIds: string[]) => {
      const idsToClose = [...new Set(sourceIds)].filter(
        (id) => sourcesById.has(id) && !closingSourceIds.has(id),
      );

      if (idsToClose.length === 0) return;

      if (prefersReducedMotion) {
        void dispatch(closeEditingInstancesRequested(idsToClose));
        return;
      }

      setClosingSourceIds((current) => new Set([...current, ...idsToClose]));
      setTimeout(() => {
        void dispatch(closeEditingInstancesRequested(idsToClose));
        setClosingSourceIds((current) => {
          const next = new Set(current);
          idsToClose.forEach((id) => next.delete(id));
          return next;
        });
      }, SOURCE_LIST_CLOSE_ANIMATION_DURATION_MS);
    },
    [closingSourceIds, dispatch, prefersReducedMotion, sourcesById],
  );

  if (sources.length === 0) return <SourceListEmpty />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources }) : children;

  return (
    <SourceListContext.Provider
      value={{
        closingSourceIds,
        matchesBySourceId,
        requestCloseSources,
        search,
        setSearch: handleSearchChange,
        sources: filteredSources,
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
