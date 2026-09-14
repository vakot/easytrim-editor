import { createContext, useContext } from "react";

export interface SourceSelectionContextValue {
  selectedSourceIds: ReadonlySet<string>;
  selectSource: (sourceId: string, modifiers: SourceSelectionModifiers) => void;
}

export interface SourceSelectionModifiers {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export const SourceSelectionContext = createContext<SourceSelectionContextValue | null>(null);

export function useSourceSelection(): SourceSelectionContextValue {
  const context = useContext(SourceSelectionContext);
  if (context) return context;

  return {
    selectedSourceIds: new Set(),
    selectSource: () => undefined,
  };
}
