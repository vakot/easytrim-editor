import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/class-names.utils";

type HighlightRange = readonly [number, number];

function Highlight({
  children,
  className,
  query,
  ranges,
  ...props
}: ComponentProps<"mark"> & {
  children: string;
  query?: string;
  ranges?: ReadonlyArray<HighlightRange>;
}) {
  const normalizedQuery = query?.trim().toLocaleLowerCase() ?? "";
  const matchRanges = ranges ?? getQueryRanges(children, normalizedQuery);
  if (matchRanges.length === 0) return children;

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const [rangeStart, rangeEnd] of matchRanges) {
    const matchStart = Math.max(cursor, rangeStart);
    const matchEnd = Math.min(children.length - 1, rangeEnd);
    if (matchStart > matchEnd || matchStart >= children.length) continue;

    if (matchStart > cursor) parts.push(children.slice(cursor, matchStart));
    parts.push(
      <mark
        className={cn("rounded-xs bg-primary/25 text-inherit", className)}
        key={matchStart}
        {...props}
      >
        {children.slice(matchStart, matchEnd + 1)}
      </mark>,
    );
    cursor = matchEnd + 1;
  }

  if (cursor < children.length) parts.push(children.slice(cursor));

  return parts;
}

function getQueryRanges(text: string, query: string): HighlightRange[] {
  if (!query) return [];

  const normalizedText = text.toLocaleLowerCase();
  const ranges: HighlightRange[] = [];
  let start = 0;

  while (start < text.length) {
    const matchStart = normalizedText.indexOf(query, start);
    if (matchStart < 0) break;
    ranges.push([matchStart, matchStart + query.length - 1]);
    start = matchStart + query.length;
  }

  return ranges;
}

export { Highlight };
export type { HighlightRange };
