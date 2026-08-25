import { useState, type ReactNode } from "react";
import type { Layout } from "react-resizable-panels";

import { EditorViewStateContext } from "@/app/editor-view-state-context";

export function EditorViewStateProvider({ children }: { children: ReactNode }) {
  const [showSourceDetails, setShowSourceDetails] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [workspaceLayout, setWorkspaceLayout] = useState<Layout>();
  const [editorStageLayout, setEditorStageLayout] = useState<Layout>();

  return (
    <EditorViewStateContext.Provider
      value={{
        showSourceDetails,
        setShowSourceDetails,
        showTimeline,
        setShowTimeline,
        workspaceLayout,
        setWorkspaceLayout,
        editorStageLayout,
        setEditorStageLayout,
      }}
    >
      {children}
    </EditorViewStateContext.Provider>
  );
}
