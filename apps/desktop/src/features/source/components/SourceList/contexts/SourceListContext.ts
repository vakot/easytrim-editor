import { createContext, useContext } from "react";

import type { EditingInstanceListEntry } from "@/domain/editing-instance";

import type { SourceSearchResult } from "../../../lib/source-search.utils";

const SOURCE_LIST_CLOSE_ANIMATION_DURATION_MS = 160;

type SourceListState = {
  closingSourceIds: ReadonlySet<string>;
  matchesBySourceId: ReadonlyMap<string, SourceSearchResult>;
  requestCloseSources: (sourceIds: string[]) => void;
  search: string;
  setSearch: (value: string) => void;
  sources: EditingInstanceListEntry[];
};

const SourceListContext = createContext<SourceListState | null>(null);

function useSourceListData() {
  const context = useContext(SourceListContext);

  if (!context) {
    throw new Error("SourceListContent must be used within SourceList");
  }

  return context;
}

function useSourceListCloseRequest() {
  return useContext(SourceListContext)?.requestCloseSources;
}

export {
  SOURCE_LIST_CLOSE_ANIMATION_DURATION_MS,
  SourceListContext,
  useSourceListCloseRequest,
  useSourceListData,
};
export type { SourceListState };
