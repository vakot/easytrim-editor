import { createContext, useContext } from "react";

import type { EditingInstanceListEntry } from "@/domain/editing-instance";

import type { SourceSearchResult } from "../../../lib/source-search.utils";

type SourceListTab = "none" | "folder" | "time" | "imported";

type SourceListPresentationEntry = {
  entry: EditingInstanceListEntry;
  isExiting: boolean;
};

type SourceListState = {
  addedSourceIds: ReadonlySet<string>;
  consumeSourceAddition: (sourceId: string) => boolean;
  matchesBySourceId: ReadonlyMap<string, SourceSearchResult>;
  presentationSources: readonly SourceListPresentationEntry[];
  search: string;
  setSearch: (value: string) => void;
  sources: EditingInstanceListEntry[];
  tab: SourceListTab;
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
export type { SourceListPresentationEntry, SourceListState, SourceListTab };
