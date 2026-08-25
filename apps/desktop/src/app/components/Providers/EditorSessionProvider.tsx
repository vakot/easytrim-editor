import { useEffect, useState, type ReactNode } from "react";

import { FULL_CROP, type CropRect } from "@/features/preview/utils/crop-geometry";
import { useEasyTrimEditorApp } from "@/app/hooks/useEasyTrimEditorApp";
import { EditorSessionContext } from "@/app/contexts/editor-session-context";
import { selectSourceMedia } from "@/app/store/slices/session-slice";
import { useAppSelector } from "@/app/store/hooks";

export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const app = useEasyTrimEditorApp();
  const media = useAppSelector(selectSourceMedia);
  const sourceDimensions = media
    ? { width: media.video.width, height: media.video.height }
    : { width: 1, height: 1 };
  const [cropResolution, setCropResolution] = useState(sourceDimensions);
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);

  useEffect(() => {
    if (!media) {
      return;
    }
    // Crop UI state follows the active source and is intentionally not persisted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCropResolution({ width: media.video.width, height: media.video.height });
    setCrop(FULL_CROP);
  }, [media]);

  return (
    <EditorSessionContext.Provider
      value={{
        ...app,
        cropResolution,
        crop,
        setCropResolution,
        setCrop,
      }}
    >
      {children}
    </EditorSessionContext.Provider>
  );
}
