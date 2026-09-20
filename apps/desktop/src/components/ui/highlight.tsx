import type { ReactNode } from "react";

import { cn } from "@/lib/class-names.utils";

interface HighlightProps {
  children: string;
  className?: string;
  query: string;
}

function Highlight({ children, className, query }: HighlightProps) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return children;

  const normalizedText = children.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;

  while (start < children.length) {
    const matchStart = normalizedText.indexOf(normalizedQuery, start);
    if (matchStart < 0) {
      parts.push(children.slice(start));
      break;
    }

    if (matchStart > start) parts.push(children.slice(start, matchStart));
    parts.push(
      <mark className={cn("rounded-sm bg-primary/25 px-1 text-inherit", className)} key={matchStart}>
        {children.slice(matchStart, matchStart + normalizedQuery.length)}
      </mark>,
    );
    start = matchStart + normalizedQuery.length;
  }

  return parts;
}

export { Highlight };
