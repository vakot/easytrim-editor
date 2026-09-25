import { type ReactNode, useCallback, useMemo, useState } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectImportedEditingInstances } from "@/app/store/slices/editing-instances-slice";

import { createSourceSearcher } from "../../lib/source-search.utils";

import { SourceListCloseAll } from "./components/SourceListCloseAll";
import { SourceListContent } from "./components/SourceListContent";
import { SourceListEmpty } from "./components/SourceListEmpty";
import { SourceListSearch } from "./components/SourceListSearch";
import type { SourceListState } from "./contexts/SourceListContext";
import { SourceListContext } from "./contexts/SourceListContext";
import { usePrepareSources } from "./hooks/usePrepareSources";

const SOURCE_LIST_PAGE_SIZE = 12;

interface SourceListProps {
  children?: ReactNode | ((state: Pick<SourceListState, "search" | "sources">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const sources = useAppSelector(selectImportedEditingInstances);
  const [search, setSearch] = useState("");
  const [visibleSourceCount, setVisibleSourceCount] = useState(SOURCE_LIST_PAGE_SIZE);

  const searchSources = useMemo(() => createSourceSearcher(sources), [sources]);
  const searchResults = useMemo(() => searchSources(search), [search, searchSources]);
  const filteredSources = useMemo(() => searchResults.map(({ source }) => source), [searchResults]);
  const matchesBySourceId = useMemo(
    () => new Map(searchResults.map((result) => [result.source.id, result])),
    [searchResults],
  );

  const visibleSources = useMemo(
    () => filteredSources.slice(0, visibleSourceCount),
    [filteredSources, visibleSourceCount],
  );

  const hasMore = visibleSources.length < filteredSources.length;
  const isLoading = usePrepareSources(visibleSources);

  const next = useCallback(() => {
    setVisibleSourceCount((count) => count + SOURCE_LIST_PAGE_SIZE);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setVisibleSourceCount(SOURCE_LIST_PAGE_SIZE);
  }, []);

  if (sources.length === 0) return <SourceListEmpty />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources }) : children;

  return (
    <SourceListContext.Provider
      value={{
        hasMore,
        isLoading,
        matchesBySourceId,
        next,
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
