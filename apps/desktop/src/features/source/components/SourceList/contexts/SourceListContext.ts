import { createContext, useContext } from "react";

import type { EditingInstance } from "@/domain/editing-instance";

import type { SourceSearchResult } from "../../../lib/source-search.utils";

type SourceListTab = "none" | "folder" | "time" | "imported";

type SourceListState = {
  hasMore: boolean;
  matchesBySourceId: ReadonlyMap<string, SourceSearchResult>;
  next: () => void;
  search: string;
  setSearch: (value: string) => void;
  sources: EditingInstance[];
  tab: SourceListTab;
  visibleSources: EditingInstance[];
};

const SourceListContext = createContext<SourceListState | null>(null);

function useSourceListData() {
  const context = useContext(SourceListContext);

  if (!context) {
    throw new Error("SourceListContent must be used within SourceList");
  }

  return context;
}

export { SourceListContext, useSourceListData };
export type { SourceListState, SourceListTab };
