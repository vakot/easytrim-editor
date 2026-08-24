import { useState, type ReactNode } from "react";
import type { Layout } from "react-resizable-panels";

import { EditorViewStateContext, type EditorToolState } from "@/app/editor-view-state-context";

const initialTools: EditorToolState = {
  safeTrimFollowingEnabled: true,
  loopPlaybackEnabled: true,
  segmentPlaybackEnabled: true,
  playbackSpeed: 1,
};

export function EditorViewStateProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<EditorToolState>(initialTools);
  const [showSourceDetails, setShowSourceDetails] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [workspaceLayout, setWorkspaceLayout] = useState<Layout>();
  const [editorStageLayout, setEditorStageLayout] = useState<Layout>();

  return (
    <EditorViewStateContext.Provider
      value={{
        tools,
        setTools,
        resetTools: () => setTools(initialTools),
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
