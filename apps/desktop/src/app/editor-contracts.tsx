import type { ReactNode } from "react";

import { EditorInteractionContext } from "@/app/editor-contracts-context";
import { useEditorInteractionController } from "@/app/hooks/useEditorInteractionController";

export function EditorContractsProvider({ children }: { children: ReactNode }) {
  const interaction = useEditorInteractionController();
  return (
    <EditorInteractionContext.Provider value={interaction}>
      {children}
    </EditorInteractionContext.Provider>
  );
}
