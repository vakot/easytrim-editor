import { useContext } from "react";

import { EditorViewStateContext } from "@/app/editor-view-state-context";

export function useEditorViewState() {
  const value = useContext(EditorViewStateContext);
  if (!value) {
    throw new Error("useEditorViewState must be used within EditorViewStateProvider.");
  }
  return value;
}
