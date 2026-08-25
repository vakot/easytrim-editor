import { createContext } from "react";
import type { Layout } from "react-resizable-panels";

export interface EditorViewStateValue {
  showSourceDetails: boolean;
  setShowSourceDetails: (visible: boolean) => void;
  showTimeline: boolean;
  setShowTimeline: (visible: boolean) => void;
  workspaceLayout: Layout | undefined;
  setWorkspaceLayout: (layout: Layout) => void;
  editorStageLayout: Layout | undefined;
  setEditorStageLayout: (layout: Layout) => void;
}

export const EditorViewStateContext = createContext<EditorViewStateValue | null>(null);
