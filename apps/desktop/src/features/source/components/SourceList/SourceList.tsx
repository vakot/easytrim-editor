import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

interface SourceListProps {
  children?:
    ReactNode | ((state: Pick<SourceListState, "search" | "sources" | "tab">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const sources = useAppSelector(selectSourceListEntries);
  const searchEntries = useAppSelector(selectSourceSearchEntries);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<SourceListTab>("none");
  const previousSourceIds = useRef(new Set(sources.map(({ id }) => id)));
  const pendingAddedSourceIds = useRef(new Set<string>());
  const [addedSourceIds, setAddedSourceIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const nextSourceIds = new Set(sources.map(({ id }) => id));
    const added = new Set(
      [...nextSourceIds].filter((sourceId) => !previousSourceIds.current.has(sourceId)),
    );

    previousSourceIds.current = nextSourceIds;
    for (const sourceId of added) pendingAddedSourceIds.current.add(sourceId);
    setAddedSourceIds(added);
  }, [sources]);
  const consumeSourceAddition = useCallback((sourceId: string) => {
    if (!pendingAddedSourceIds.current.has(sourceId)) return false;
    pendingAddedSourceIds.current.delete(sourceId);
    return true;
  }, []);

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

  if (sources.length === 0) return <SourceListEmpty />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources, tab }) : children;

  return (
    <SourceListContext.Provider
      value={{
        addedSourceIds,
        consumeSourceAddition,
        matchesBySourceId,
        search,
        setSearch,
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
