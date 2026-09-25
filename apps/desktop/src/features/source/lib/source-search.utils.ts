import Fuse, { type IFuseOptions } from "fuse.js";

import type { EditingInstanceSearchEntry } from "@/domain/editing-instance";
import type { SearchMatchRange } from "@/domain/search.types";

interface SourceSearchResult {
  displayNameRanges: ReadonlyArray<SearchMatchRange>;
  source: EditingInstanceSearchEntry;
  sourcePathRanges: ReadonlyArray<SearchMatchRange>;
}

const sourceSearchOptions = {
  includeMatches: true,
  ignoreLocation: true,
  keys: [
    { name: "displayName", weight: 2 },
    { name: "sourcePath", weight: 1 },
  ],
  threshold: 0.3,
  useTokenSearch: true,
  tokenMatch: "all",
} satisfies IFuseOptions<EditingInstanceSearchEntry>;

function createSourceSearcher(sources: EditingInstanceSearchEntry[]) {
  const fuse = new Fuse(sources, sourceSearchOptions);

  return (query: string): SourceSearchResult[] => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return sources.map((source) => ({ displayNameRanges: [], source, sourcePathRanges: [] }));
    }

    return fuse.search(normalizedQuery).map((result) => {
      const nameMatch = result.matches?.find(({ key }) => key === "displayName");
      const pathMatch = result.matches?.find(({ key }) => key === "sourcePath");

      return {
        displayNameRanges: nameMatch?.indices ?? [],
        source: result.item,
        sourcePathRanges: adjustPathRanges(result.item.sourcePath, pathMatch?.indices),
      };
    });
  };
}

function adjustPathRanges(path: string, ranges: ReadonlyArray<SearchMatchRange> | undefined) {
  const prefix = "\\\\?\\";
  const offset = path.startsWith(prefix) ? prefix.length : 0;
  return (ranges ?? [])
    .map(([start, end]) => [start - offset, end - offset] as const)
    .filter(([start, end]) => end >= 0 && start < path.length - offset);
}

export { createSourceSearcher };
export type { SourceSearchResult };
