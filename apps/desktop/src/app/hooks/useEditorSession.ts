import { useContext } from "react";

import { EditorSessionContext } from "@/app/editor-session-context-value";

export function useEditorSession() {
  const value = useContext(EditorSessionContext);
  if (!value) {
    throw new Error("useEditorSession must be used within EditorSessionProvider.");
  }
  return value;
}
