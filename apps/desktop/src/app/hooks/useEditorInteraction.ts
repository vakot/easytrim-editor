import { useContext } from "react";

import { EditorInteractionContext } from "@/app/contexts/editor-contracts-context";

export function useEditorInteraction() {
  const value = useContext(EditorInteractionContext);
  if (!value) {
    throw new Error("Editor interaction contracts must be used within EditorContractsProvider.");
  }
  return value;
}
