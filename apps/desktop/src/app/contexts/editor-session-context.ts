import { createContext } from "react";

import type { useEasyTrimEditorApp } from "@/app/hooks/useEasyTrimEditorApp";

export type EditorSession = ReturnType<typeof useEasyTrimEditorApp>;

export const EditorSessionContext = createContext<EditorSession | null>(null);
