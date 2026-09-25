import Fuse, { type IFuseOptions } from "fuse.js";

import type { HighlightRange } from "@/components/ui/highlight";

import type { EditingInstance } from "@/domain/editing-instance";

interface SourceSearchResult {
  displayNameRanges: ReadonlyArray<HighlightRange>;
  source: EditingInstance;
  sourcePathRanges: ReadonlyArray<HighlightRange>;
}

const sourceSearchOptions = {
  includeMatches: true,
  ignoreLocation: true,
  keys: [
    { name: "snapshot.source.displayName", weight: 2 },
    { name: "snapshot.source.sourcePath", weight: 1 },
  ],
  threshold: 0.3,
  useTokenSearch: true,
  tokenMatch: "all",
} satisfies IFuseOptions<EditingInstance>;

function searchSources(sources: EditingInstance[], query: string): SourceSearchResult[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return sources.map((source) => ({ displayNameRanges: [], source, sourcePathRanges: [] }));
  }

  return new Fuse(sources, sourceSearchOptions).search(normalizedQuery).map((result) => {
    const nameMatch = result.matches?.find(({ key }) => key === "snapshot.source.displayName");
    const pathMatch = result.matches?.find(({ key }) => key === "snapshot.source.sourcePath");

    return {
      displayNameRanges: nameMatch?.indices ?? [],
      source: result.item,
      sourcePathRanges: adjustPathRanges(
        result.item.snapshot.source.sourcePath,
        pathMatch?.indices,
      ),
    };
  });
}

function adjustPathRanges(path: string, ranges: ReadonlyArray<HighlightRange> | undefined) {
  const prefix = "\\\\?\\";
  const offset = path.startsWith(prefix) ? prefix.length : 0;
  return (ranges ?? [])
    .map(([start, end]) => [start - offset, end - offset] as const)
    .filter(([start, end]) => end >= 0 && start < path.length - offset);
}

export { searchSources };
export type { SourceSearchResult };
