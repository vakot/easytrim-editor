import { createContext } from "react";

import type { useEditorInteractionController } from "@/app/hooks/useEditorInteractionController";

export type EditorInteraction = ReturnType<typeof useEditorInteractionController>;
export const EditorInteractionContext = createContext<EditorInteraction | null>(null);
