import { createContext } from "react";
import type { Layout } from "react-resizable-panels";

import type { PlaybackSpeed } from "@/features/editor/hooks/usePlaybackSpeed";

export interface EditorToolState {
  safeTrimFollowingEnabled: boolean;
  loopPlaybackEnabled: boolean;
  segmentPlaybackEnabled: boolean;
  playbackSpeed: PlaybackSpeed;
}

export interface EditorViewStateValue {
  tools: EditorToolState;
  setTools: (tools: EditorToolState) => void;
  resetTools: () => void;
  showSourceDetails: boolean;
  setShowSourceDetails: (visible: boolean) => void;
  showAudioTracks: boolean;
  setShowAudioTracks: (visible: boolean) => void;
  workspaceLayout: Layout | undefined;
  setWorkspaceLayout: (layout: Layout) => void;
  editorStageLayout: Layout | undefined;
  setEditorStageLayout: (layout: Layout) => void;
}

export const EditorViewStateContext = createContext<EditorViewStateValue | null>(null);
