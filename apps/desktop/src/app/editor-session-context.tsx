import { useEffect, useState, type ReactNode } from "react";

import { FULL_CROP, type CropRect } from "@/features/preview/utils/crop-geometry";
import { useEasyTrimEditorApp } from "@/app/hooks/useEasyTrimEditorApp";
import { EditorSessionContext } from "@/app/editor-session-context-value";
import { selectMergeAudioDefault } from "@/app/preferences-slice";
import { useAppSelector } from "@/app/store";

export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const defaultMergeAudio = useAppSelector(selectMergeAudioDefault);
  const app = useEasyTrimEditorApp(defaultMergeAudio);
  const source = app.session.source;
  const sourceDimensions = source?.media
    ? { width: source.media.video.width, height: source.media.video.height }
    : { width: 1, height: 1 };
  const [cropResolution, setCropResolution] = useState(sourceDimensions);
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);

  useEffect(() => {
    if (!source?.media) {
      return;
    }
    // Crop UI state follows the active source and is intentionally not persisted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCropResolution({ width: source.media.video.width, height: source.media.video.height });
    setCrop(FULL_CROP);
  }, [source?.media, source?.selection.sourceId]);

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
