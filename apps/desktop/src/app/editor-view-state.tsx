import { useState, type ReactNode } from "react";
import type { Layout } from "react-resizable-panels";

import { EditorViewStateContext, type EditorToolState } from "@/app/editor-view-state-context";
import { selectToolDefaults } from "@/app/preferences-slice";
import { useAppSelector } from "@/app/store";

function createActiveToolState(defaults: ReturnType<typeof selectToolDefaults>): EditorToolState {
  return {
    safeTrimFollowingEnabled: defaults.safeTrimFollowingEnabled,
    loopPlaybackEnabled: defaults.loopPlaybackEnabled,
    segmentPlaybackEnabled: defaults.segmentPlaybackEnabled,
    playbackSpeed: 1,
  };
}

export function EditorViewStateProvider({ children }: { children: ReactNode }) {
  const toolDefaults = useAppSelector(selectToolDefaults);
  const [tools, setTools] = useState(() => createActiveToolState(toolDefaults));
  const [showSourceDetails, setShowSourceDetails] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [workspaceLayout, setWorkspaceLayout] = useState<Layout>();
  const [editorStageLayout, setEditorStageLayout] = useState<Layout>();

  const resetTools = () => setTools(createActiveToolState(toolDefaults));

  return (
    <EditorViewStateContext.Provider
      value={{
        tools,
        setTools,
        resetTools,
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
