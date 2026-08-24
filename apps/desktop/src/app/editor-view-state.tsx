import { useEffect, useState, type ReactNode } from "react";
import type { Layout } from "react-resizable-panels";

import { EditorViewStateContext, type EditorToolState } from "@/app/editor-view-state-context";
import {
  DEFAULT_TOOL_DEFAULTS,
  loadToolDefaults,
  persistToolDefaults,
  type ToolDefaultKey,
  type ToolDefaults,
} from "@/app/tool-settings";

interface ToolViewState {
  defaults: ToolDefaults;
  active: EditorToolState;
}

function createToolViewState(): ToolViewState {
  const defaults = loadToolDefaults();
  return {
    defaults,
    active: {
      safeTrimFollowingEnabled: defaults.safeTrimFollowingEnabled,
      loopPlaybackEnabled: defaults.loopPlaybackEnabled,
      segmentPlaybackEnabled: defaults.segmentPlaybackEnabled,
      playbackSpeed: 1,
    },
  };
}

export function EditorViewStateProvider({ children }: { children: ReactNode }) {
  const [toolViewState, setToolViewState] = useState(createToolViewState);
  const [showSourceDetails, setShowSourceDetails] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [workspaceLayout, setWorkspaceLayout] = useState<Layout>();
  const [editorStageLayout, setEditorStageLayout] = useState<Layout>();

  useEffect(() => {
    persistToolDefaults(toolViewState.defaults);
  }, [toolViewState.defaults]);

  const setTools = (active: EditorToolState) =>
    setToolViewState((current) => ({ ...current, active }));
  const resetTools = () =>
    setToolViewState((current) => ({
      ...current,
      active: {
        safeTrimFollowingEnabled: current.defaults.safeTrimFollowingEnabled,
        loopPlaybackEnabled: current.defaults.loopPlaybackEnabled,
        segmentPlaybackEnabled: current.defaults.segmentPlaybackEnabled,
        playbackSpeed: 1,
      },
    }));
  const setToolDefault = (key: ToolDefaultKey, enabled: boolean) =>
    setToolViewState((current) => ({
      defaults: { ...current.defaults, [key]: enabled },
      active: key === "mergeAudioEnabled" ? current.active : { ...current.active, [key]: enabled },
    }));
  const resetToolDefaults = () =>
    setToolViewState({
      defaults: DEFAULT_TOOL_DEFAULTS,
      active: {
        safeTrimFollowingEnabled: DEFAULT_TOOL_DEFAULTS.safeTrimFollowingEnabled,
        loopPlaybackEnabled: DEFAULT_TOOL_DEFAULTS.loopPlaybackEnabled,
        segmentPlaybackEnabled: DEFAULT_TOOL_DEFAULTS.segmentPlaybackEnabled,
        playbackSpeed: 1,
      },
    });

  return (
    <EditorViewStateContext.Provider
      value={{
        tools: toolViewState.active,
        setTools,
        resetTools,
        toolDefaults: toolViewState.defaults,
        setToolDefault,
        resetToolDefaults,
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
