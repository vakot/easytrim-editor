import { useContext } from "react";

import { EditorSessionContext } from "@/app/contexts/editor-session-context";

export function useEditorSession() {
  const value = useContext(EditorSessionContext);
  if (!value) {
    throw new Error("useEditorSession must be used within EditorSessionProvider.");
  }
  return value;
}
