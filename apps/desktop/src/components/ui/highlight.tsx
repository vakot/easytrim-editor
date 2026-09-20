import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/class-names.utils";

function Highlight({
  children,
  className,
  query,
  ...props
}: ComponentProps<"mark"> & { children: string; query: string }) {
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
      <mark
        className={cn("rounded-xs bg-primary/25 text-inherit", className)}
        key={matchStart}
        {...props}
      >
        {children.slice(matchStart, matchStart + normalizedQuery.length)}
      </mark>,
    );
    start = matchStart + normalizedQuery.length;
  }

  return parts;
}

export { Highlight };
