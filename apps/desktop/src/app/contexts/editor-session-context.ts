import { createContext } from "react";

import type { useEasyTrimEditorApp } from "@/app/hooks/useEasyTrimEditorApp";
import type { CropRect } from "@/features/preview/utils/crop-geometry";

export type EditorSession = ReturnType<typeof useEasyTrimEditorApp> & {
  cropResolution: { width: number; height: number };
  crop: CropRect;
  setCropResolution: (resolution: { width: number; height: number }) => void;
  setCrop: (crop: CropRect) => void;
};

export const EditorSessionContext = createContext<EditorSession | null>(null);
