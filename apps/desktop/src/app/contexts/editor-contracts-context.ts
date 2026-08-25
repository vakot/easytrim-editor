import { createContext } from "react";

import type { EditorInteractionRuntime } from "@/app/hooks/useEditorInteractionController";

export type EditorInteraction = EditorInteractionRuntime;
export const EditorInteractionContext = createContext<EditorInteraction | null>(null);
