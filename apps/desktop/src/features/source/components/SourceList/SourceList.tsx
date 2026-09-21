import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { Tabs } from "@/components/ui/tabs";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectImportedEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { filterSourcesByPath } from "../../lib/source-search.utils";

import { SourceListContent } from "./components/SourceListContent";
import { SourceListCloseAll } from "./components/SourceListCloseAll";
import { SourceListEmptyState } from "./components/SourceListEmptyState";
import { SourceListSearch } from "./components/SourceListSearch";
import { SourceListTabs } from "./components/SourceListTabs";
import type { SourceListState, SourceListTab } from "./contexts/SourceListContext";
import { SourceListContext } from "./contexts/SourceListContext";
import { usePrepareSources } from "./hooks/usePrepareSources";

const SOURCE_LIST_PAGE_SIZE = 12;

interface SourceListProps {
  children?:
    ReactNode | ((state: Pick<SourceListState, "search" | "sources" | "tab">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const sources = useAppSelector(selectImportedEditingInstances);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<SourceListTab>("none");
  const [visibleSourceCount, setVisibleSourceCount] = useState(SOURCE_LIST_PAGE_SIZE);

  const filteredSources = useMemo(() => filterSourcesByPath(sources, search), [search, sources]);
  const visibleSources = useMemo(
    () => filteredSources.slice(0, visibleSourceCount),
    [filteredSources, visibleSourceCount],
  );
  const hasMore = visibleSources.length < filteredSources.length;
  const isLoading = usePrepareSources(visibleSources);

  const next = useCallback(() => {
    setVisibleSourceCount((count) => count + SOURCE_LIST_PAGE_SIZE);
  }, []);

  useEffect(() => {
    setVisibleSourceCount(SOURCE_LIST_PAGE_SIZE);
  }, [search]);

  if (sources.length === 0) return <SourceListEmptyState />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources, tab }) : children;

  return (
    <SourceListContext.Provider
      value={{
        hasMore,
        isLoading,
        next,
        search,
        setSearch,
        sources: filteredSources,
        tab,
        visibleSources,
      }}
    >
      <Tabs
        className="min-h-0 flex-1"
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
