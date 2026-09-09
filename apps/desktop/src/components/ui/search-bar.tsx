import { Search } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";

import { cn } from "@/lib/class-names.utils";
import { normalizeSearchValue } from "@/lib/search.utils";

interface SearchBarProps extends Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "type" | "value"
> {
  onValueChange: (value: string) => void;
  value: string;
}

function SearchBar({ className, onValueChange, value, ...props }: SearchBarProps) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        {...props}
        className={cn("pl-8", className)}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        type="search"
        value={value}
      />
    </div>
  );
}

function HighlightedText({ query, text }: { query: string; text: string }) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return text;

  const normalizedText = text.toLocaleLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;

  while (start < text.length) {
    const matchStart = normalizedText.indexOf(normalizedQuery, start);
    if (matchStart < 0) {
      parts.push(text.slice(start));
      break;
    }

    if (matchStart > start) parts.push(text.slice(start, matchStart));
    parts.push(
      <mark className="rounded-sm bg-primary/25 text-inherit" key={matchStart}>
        {text.slice(matchStart, matchStart + normalizedQuery.length)}
      </mark>,
    );
    start = matchStart + normalizedQuery.length;
  }

  return parts;
}

export { HighlightedText, SearchBar };
