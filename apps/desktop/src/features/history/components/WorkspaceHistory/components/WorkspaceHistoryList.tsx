import { forwardRef, useState } from "react";
import { type ListProps, Virtuoso } from "react-virtuoso";

import { ScrollArea } from "@/components/ui/scroll-area";

import type { WorkspaceHistoryRow } from "../types";

import { WorkspaceHistoryEntry } from "./WorkspaceHistoryEntry";

interface WorkspaceHistoryListProps {
  disabled: boolean;
  onSelect: (row: WorkspaceHistoryRow) => void;
  rows: WorkspaceHistoryRow[];
  sourcesFor: (row: WorkspaceHistoryRow) => string[];
  stateFor: (row: WorkspaceHistoryRow) => "active" | "applied" | "redo";
}

const HistoryVirtualizedList = forwardRef<HTMLDivElement, ListProps<HTMLDivElement>>(
  function HistoryVirtualizedList({ children, style }, ref) {
    return (
      <div className="flex flex-col" ref={ref} role="list" style={style}>
        {children}
      </div>
    );
  },
);

function HistoryListEdgeSpacer() {
  return <div aria-hidden="true" className="h-2" />;
}

const virtuosoComponents = {
  Header: HistoryListEdgeSpacer,
  Footer: HistoryListEdgeSpacer,
  List: HistoryVirtualizedList,
};

function WorkspaceHistoryList({
  disabled,
  onSelect,
  rows,
  sourcesFor,
  stateFor,
}: WorkspaceHistoryListProps) {
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);

  return (
    <ScrollArea
      className="-mx-2 min-h-0 flex-1 **:data-[slot=scroll-area-viewport]:px-2"
      viewportRef={setScrollParent}
    >
      {scrollParent ? (
        <Virtuoso
          className="w-full"
          components={virtuosoComponents}
          computeItemKey={(_, row) => row.operation?.id ?? "beginning"}
          customScrollParent={scrollParent}
          data={rows}
          defaultItemHeight={70}
          followOutput="auto"
          initialTopMostItemIndex={rows.length - 1}
          itemContent={(_, row) => (
            <WorkspaceHistoryEntry
              disabled={disabled || stateFor(row) === "active"}
              onSelect={onSelect}
              row={row}
              sources={sourcesFor(row)}
              state={stateFor(row)}
            />
          )}
        />
      ) : null}
    </ScrollArea>
  );
}

export { WorkspaceHistoryList };
