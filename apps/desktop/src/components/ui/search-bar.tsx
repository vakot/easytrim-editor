import { cva, type VariantProps } from "class-variance-authority";
import { Search } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";

import { cn } from "@/lib/class-names.utils";
import { normalizeSearchValue } from "@/lib/search.utils";

const searchBarInputVariants = cva("", {
  variants: {
    size: {
      default: "h-8 pl-8 text-sm",
      xs: "h-6 pl-6 text-xs",
      sm: "h-7 pl-7 text-sm",
      lg: "h-9 pl-8 text-sm",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const searchBarIconVariants = cva(
  "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
  {
    variants: {
      size: {
        default: "left-2.5 size-4",
        xs: "left-2 size-3",
        sm: "left-2.5 size-3.5",
        lg: "left-2.5 size-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

interface SearchBarProps
  extends
    Omit<React.ComponentProps<typeof Input>, "onChange" | "size" | "type" | "value">,
    VariantProps<typeof searchBarInputVariants> {
  onValueChange: (value: string) => void;
  value: string;
}

function SearchBar({ className, onValueChange, size = "sm", value, ...props }: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden="true" className={searchBarIconVariants({ size })} />
      <Input
        {...props}
        className={searchBarInputVariants({ size })}
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
      <mark className="rounded-sm bg-primary/25 px-1 text-inherit" key={matchStart}>
        {text.slice(matchStart, matchStart + normalizedQuery.length)}
      </mark>,
    );
    start = matchStart + normalizedQuery.length;
  }

  return parts;
}

export { HighlightedText, SearchBar };
