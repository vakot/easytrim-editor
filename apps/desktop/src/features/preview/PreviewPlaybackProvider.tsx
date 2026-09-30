import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";
import { handlePreviewPlaybackError } from "@/app/store/thunks/source-media-thunks";

import { PreviewRuntimeContext } from "./contexts/preview-runtime-context";

function PreviewPlaybackProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const sourceLoadToken = useAppSelector(selectSourceLoadToken);

  const preview = useAppSelector(selectPreview);
  const previewKey =
    sourcePath && preview.status === "ready"
      ? `${sourceLoadToken}:${sourcePath}:${preview.value.url}`
      : null;

  const [readyPreviewKey, setReadyPreviewKey] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);

  const onCanPlay = useCallback(() => {
    if (previewKey) setReadyPreviewKey(previewKey);
  }, [previewKey]);

  const onPreviewPlaybackError = useCallback(
    (previewKind: "source" | "proxy") => {
      if (sourcePath) void dispatch(handlePreviewPlaybackError(sourcePath, previewKind));
    },
    [dispatch, sourcePath],
  );

  const runtime = useMemo(
    () => ({
      isPreviewReady: previewKey !== null && readyPreviewKey === previewKey,
      onCanPlay,
      onPreviewPlaybackError,
      previewKey,
      setVideoElement,
      videoRef,
    }),
    [onCanPlay, onPreviewPlaybackError, previewKey, readyPreviewKey, setVideoElement],
  );

  return (
    <PreviewRuntimeContext.Provider value={runtime}>{children}</PreviewRuntimeContext.Provider>
  );
}

export { PreviewPlaybackProvider };
