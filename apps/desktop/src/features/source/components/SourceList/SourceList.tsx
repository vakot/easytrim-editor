import { type ReactNode, useCallback, useMemo, useState } from "react";

import { Tabs } from "@/components/ui/tabs";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectImportedEditingInstances } from "@/app/store/slices/editing-instances-slice";

import { createSourceSearcher } from "../../lib/source-search.utils";

import { SourceListCloseAll } from "./components/SourceListCloseAll";
import { SourceListContent } from "./components/SourceListContent";
import { SourceListEmpty } from "./components/SourceListEmpty";
import { SourceListSearch } from "./components/SourceListSearch";
import { SourceListTabs } from "./components/SourceListTabs";
import type { SourceListState, SourceListTab } from "./contexts/SourceListContext";
import { SourceListContext } from "./contexts/SourceListContext";

interface SourceListProps {
  children?:
    ReactNode | ((state: Pick<SourceListState, "search" | "sources" | "tab">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const sources = useAppSelector(selectImportedEditingInstances);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<SourceListTab>("none");

  const searchSources = useMemo(() => createSourceSearcher(sources), [sources]);
  const searchResults = useMemo(() => searchSources(search), [search, searchSources]);
  const filteredSources = useMemo(() => searchResults.map(({ source }) => source), [searchResults]);
  const matchesBySourceId = useMemo(
    () => new Map(searchResults.map((result) => [result.source.id, result])),
    [searchResults],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  if (sources.length === 0) return <SourceListEmpty />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources, tab }) : children;

  return (
    <SourceListContext.Provider
      value={{
        matchesBySourceId,
        search,
        setSearch: handleSearchChange,
        sources: filteredSources,
        tab,
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
