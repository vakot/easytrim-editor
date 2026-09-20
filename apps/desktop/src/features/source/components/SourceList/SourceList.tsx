import { type ReactNode, useMemo, useState } from "react";

import { Tabs } from "@/components/ui/tabs";

import { filterSourcesByPath } from "../../lib/source-search.utils";

import { SourceListContent } from "./components/SourceListContent";
import { SourceListEmptyState } from "./components/SourceListEmptyState";
import { SourceListSearch } from "./components/SourceListSearch";
import { SourceListTabs } from "./components/SourceListTabs";
import type { SourceListState, SourceListTab } from "./contexts/SourceListContext";
import { SourceListContext } from "./contexts/SourceListContext";
import { usePrepareSources } from "./hooks/usePrepareSources";

interface SourceListProps {
  children?: ReactNode | ((state: Omit<SourceListState, "setSearch">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const sources = usePrepareSources();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<SourceListTab>("none");

  const filteredSources = useMemo(() => filterSourcesByPath(sources, search), [search, sources]);

  if (sources.length === 0) return <SourceListEmptyState />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources, tab }) : children;

  return (
    <SourceListContext.Provider value={{ search, setSearch, sources: filteredSources, tab }}>
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

export { SourceList, SourceListContent, type SourceListProps, SourceListSearch, SourceListTabs };
