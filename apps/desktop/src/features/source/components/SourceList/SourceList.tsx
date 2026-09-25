import { type ReactNode, useCallback, useMemo, useState } from "react";

import { Tabs } from "@/components/ui/tabs";

import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectSourceListEntries,
  selectSourceSearchEntries,
} from "@/app/store/slices/editing-instances-slice";

import { createSourceSearcher } from "../../lib/source-search.utils";

import { SourceListCloseAll } from "./components/SourceListCloseAll";
import { SourceListContent } from "./components/SourceListContent";
import { SourceListEmpty } from "./components/SourceListEmpty";
import { SourceListSearch } from "./components/SourceListSearch";
import { SourceListTabs } from "./components/SourceListTabs";
import type { SourceListState, SourceListTab } from "./contexts/SourceListContext";
import { SourceListContext } from "./contexts/SourceListContext";

const SOURCE_LIST_PAGE_SIZE = 12;

interface SourceListProps {
  children?:
    ReactNode | ((state: Pick<SourceListState, "search" | "sources" | "tab">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const sources = useAppSelector(selectSourceListEntries);
  const searchEntries = useAppSelector(selectSourceSearchEntries);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<SourceListTab>("none");
  const [visibleSourceCount, setVisibleSourceCount] = useState(SOURCE_LIST_PAGE_SIZE);

  const searchSources = useMemo(() => createSourceSearcher(searchEntries), [searchEntries]);
  const searchResults = useMemo(() => searchSources(search), [search, searchSources]);
  const sourcesById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const filteredSources = useMemo(
    () =>
      searchResults.flatMap(({ id }) => {
        const source = sourcesById.get(id);
        return source ? [source] : [];
      }),
    [searchResults, sourcesById],
  );

  const matchesBySourceId = useMemo(
    () => new Map(searchResults.map((result) => [result.id, result])),
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

  if (sources.length === 0) return <SourceListEmpty />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources, tab }) : children;

  return (
    <SourceListContext.Provider
      value={{
        hasMore,
        matchesBySourceId,
        next,
        search,
        setSearch: handleSearchChange,
        sources: filteredSources,
        tab,
        visibleSources,
      }}
    >
      <Tabs
        className="min-h-0 min-w-0 flex-1"
        onValueChange={(value) => setTab(value as SourceListTab)}
        value={tab}
      >
        {child ?? <SourceListContent />}
      </Tabs>
    </SourceListContext.Provider>
  );
}

export {
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  type SourceListProps,
  SourceListSearch,
  SourceListTabs,
};
