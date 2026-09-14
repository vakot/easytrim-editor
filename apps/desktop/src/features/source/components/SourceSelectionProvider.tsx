import { type ReactNode, useCallback, useRef } from "react";

import { SourceSelectionContext, type SourceSelectionModifiers } from "./SourceSelectionContext";

interface SourceSelectionProviderProps {
  children: ReactNode;
  onSelectedSourceIdsChange: (sourceIds: Set<string>) => void;
  selectedSourceIds: ReadonlySet<string>;
  sourceIds: readonly string[];
}

export function SourceSelectionProvider({
  children,
  onSelectedSourceIdsChange,
  selectedSourceIds,
  sourceIds,
}: SourceSelectionProviderProps) {
  const selectionAnchorId = useRef<string | null>(null);

  const selectSource = useCallback(
    (sourceId: string, modifiers: SourceSelectionModifiers) => {
      const toggleSelection = modifiers.ctrlKey || modifiers.metaKey;
      const sourceIndex = sourceIds.indexOf(sourceId);
      const anchorIndex = selectionAnchorId.current
        ? sourceIds.indexOf(selectionAnchorId.current)
        : -1;

      let nextSelection: Set<string>;

      if (modifiers.shiftKey && sourceIndex !== -1 && anchorIndex !== -1) {
        const rangeStart = Math.min(sourceIndex, anchorIndex);
        const rangeEnd = Math.max(sourceIndex, anchorIndex);
        const rangeIds = sourceIds.slice(rangeStart, rangeEnd + 1);
        const rangeIsSelected = rangeIds.every((id) => selectedSourceIds.has(id));
        nextSelection = new Set(selectedSourceIds);

        for (const id of rangeIds) {
          if (rangeIsSelected) nextSelection.delete(id);
          else nextSelection.add(id);
        }
      } else if (toggleSelection) {
        nextSelection = new Set(selectedSourceIds);
        if (nextSelection.has(sourceId)) nextSelection.delete(sourceId);
        else nextSelection.add(sourceId);
      } else {
        nextSelection = new Set([sourceId]);
      }

      if (!modifiers.shiftKey || anchorIndex === -1) selectionAnchorId.current = sourceId;
      onSelectedSourceIdsChange(nextSelection);
    },
    [onSelectedSourceIdsChange, selectedSourceIds, sourceIds],
  );

  return (
    <SourceSelectionContext.Provider value={{ selectedSourceIds, selectSource }}>
      {children}
    </SourceSelectionContext.Provider>
  );
}
