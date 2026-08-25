import { type ReactNode } from "react";

import { useEasyTrimEditorApp } from "@/app/hooks/useEasyTrimEditorApp";
import { EditorSessionContext } from "@/app/contexts/editor-session-context";

export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const app = useEasyTrimEditorApp();

  return <EditorSessionContext.Provider value={app}>{children}</EditorSessionContext.Provider>;
}
