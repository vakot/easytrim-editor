import { createContext, useContext } from "react";

import type { EditingInstanceListEntry } from "@/domain/editing-instance";

import type { SourceSearchResult } from "../../../lib/source-search.utils";

type SourceListState = {
  hasMore: boolean;
  matchesBySourceId: ReadonlyMap<string, SourceSearchResult>;
  next: () => void;
  registerThumbnailDemand: (entry: EditingInstanceListEntry, element: HTMLElement | null) => void;
  search: string;
  setSearch: (value: string) => void;
  sources: EditingInstanceListEntry[];
  visibleSources: EditingInstanceListEntry[];
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
export type { SourceListState };
