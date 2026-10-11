import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { type ListProps, type ScrollSeekPlaceholderProps, Virtuoso } from "react-virtuoso";

import { ScrollArea } from "@/components/ui/scroll-area";

import { cn } from "@/lib/class-names.utils";

import { useSourceListData } from "../contexts/SourceListContext";
import { useSourceListScrollController } from "../hooks/useSourceListScrollController";

import { SourceListItem } from "./SourceListItem";

const SourceListVirtualizedList = forwardRef<HTMLDivElement, ListProps<HTMLDivElement>>(
  function SourceListVirtualizedList({ children, style }, ref) {
    return (
      <div
        className="flex flex-col"
        data-slot="imported-sources-grid"
        ref={ref}
        role="list"
        style={style}
      >
        {children}
      </div>
    );
  },
);

function SourceListScrollSeekPlaceholder({ height }: ScrollSeekPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className="flex min-w-0 gap-2 p-2"
      role="presentation"
      style={{ height }}
    >
      <div className="aspect-video w-40 shrink-0 animate-pulse self-center rounded-md bg-muted" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
        <div className="mt-auto flex gap-2">
          <div className="h-3 w-12 animate-pulse rounded bg-muted/70" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

function SourceListEdgeSpacer() {
  return <div aria-hidden="true" className="h-2" />;
}

const virtuosoComponents = {
  Footer: SourceListEdgeSpacer,
  Header: SourceListEdgeSpacer,
  List: SourceListVirtualizedList,
  ScrollSeekPlaceholder: SourceListScrollSeekPlaceholder,
};

interface SourceListContentProps {
  className?: string;
}

function SourceListContent({ className }: SourceListContentProps) {
  const { closingSourceIds, matchesBySourceId, search, sources } = useSourceListData();
  const { t } = useTranslation();
  const {
    customScrollParent,
    increaseViewportBy,
    rangeChanged,
    scrollSeekConfiguration,
    setScrollParent,
  } = useSourceListScrollController(sources);

  return (
    <ScrollArea className={cn("min-h-0 flex-1", className)} viewportRef={setScrollParent}>
      {search.trim() && sources.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground" role="status">
          {t("source.search.noResults")}
        </div>
      ) : customScrollParent ? (
        <Virtuoso
          className="w-full"
          components={virtuosoComponents}
          computeItemKey={(_, source) => source.id}
          customScrollParent={customScrollParent}
          data={sources}
          defaultItemHeight={112}
          increaseViewportBy={increaseViewportBy}
          itemContent={(_, source) => (
            <SourceListItem
              isClosing={closingSourceIds.has(source.id)}
              match={matchesBySourceId.get(source.id)}
              source={source}
            />
          )}
          rangeChanged={rangeChanged}
          scrollSeekConfiguration={scrollSeekConfiguration}
        />
      ) : null}
    </ScrollArea>
  );
}

export { SourceListContent };
