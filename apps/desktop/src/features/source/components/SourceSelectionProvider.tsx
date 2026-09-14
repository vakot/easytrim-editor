import { type ReactNode, useCallback, useEffect, useRef } from "react";

import { SourceSelectionContext, type SourceSelectionModifiers } from "./SourceSelectionContext";

interface SourceSelectionProviderProps {
  activeSourceId?: string | null;
  children: ReactNode;
  initialAnchorId?: string | null;
  onSelectedSourceIdsChange: (sourceIds: Set<string>) => void;
  selectedSourceIds: ReadonlySet<string>;
  sourceIds: readonly string[];
}

export function SourceSelectionProvider({
  activeSourceId = null,
  children,
  initialAnchorId = null,
  onSelectedSourceIdsChange,
  selectedSourceIds,
  sourceIds,
}: SourceSelectionProviderProps) {
  const selectionAnchorId = useRef<string | null>(resolveInitialAnchor(initialAnchorId, sourceIds));

  const appliedInitialAnchorId = useRef(initialAnchorId);

  useEffect(() => {
    if (appliedInitialAnchorId.current === initialAnchorId) return;
    appliedInitialAnchorId.current = initialAnchorId;
    if (initialAnchorId && sourceIds.includes(initialAnchorId)) {
      selectionAnchorId.current = initialAnchorId;
    }
  }, [initialAnchorId, sourceIds]);

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

      if (activeSourceId) nextSelection.add(activeSourceId);
      selectionAnchorId.current = sourceId;
      onSelectedSourceIdsChange(nextSelection);
    },
    [activeSourceId, onSelectedSourceIdsChange, selectedSourceIds, sourceIds],
  );

  return (
    <SourceSelectionContext.Provider value={{ selectedSourceIds, selectSource }}>
      {children}
    </SourceSelectionContext.Provider>
  );
}

function resolveInitialAnchor(initialAnchorId: string | null, sourceIds: readonly string[]) {
  if (initialAnchorId && sourceIds.includes(initialAnchorId)) return initialAnchorId;
  return sourceIds[0] ?? null;
}
