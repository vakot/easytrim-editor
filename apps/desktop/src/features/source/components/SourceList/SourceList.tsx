import { type ReactNode, useCallback, useMemo, useState } from "react";

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
import type { SourceListState } from "./contexts/SourceListContext";
import { SourceListContext } from "./contexts/SourceListContext";

interface SourceListProps {
  children?: ReactNode | ((state: Pick<SourceListState, "search" | "sources">) => ReactNode);
}

function SourceList({ children }: SourceListProps) {
  const sources = useAppSelector(selectSourceListEntries);
  const searchEntries = useAppSelector(selectSourceSearchEntries);
  const [search, setSearch] = useState("");
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

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  if (sources.length === 0) return <SourceListEmpty />;

  const child =
    typeof children === "function" ? children({ search, sources: filteredSources }) : children;

  return (
    <SourceListContext.Provider
      value={{
        matchesBySourceId,
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
